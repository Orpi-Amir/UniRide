import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import Message from "@/lib/models/Message";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";
import { isRideChatParticipant, normalizeEmail } from "@/lib/rideParticipant";
import { publishUserMessage, serializeMessage } from "@/lib/rideMessages";

const HISTORY_LIMIT = 200;

export async function GET(req, { params }) {
  try {
    const { id: rideId } = await params;
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    await connectDB();
    const ride = await Ride.findById(rideId).lean();
    if (!ride) {
      return Response.json({ success: false, message: "Ride not found" }, { status: 404 });
    }

    const requester = normalizeEmail(authResult.email);
    if (!isRideChatParticipant(ride, requester)) {
      return Response.json(
        { success: false, message: "You are not allowed to view this chat" },
        { status: 403 }
      );
    }

    const docs = await Message.find({ rideId })
      .sort({ createdAt: 1 })
      .limit(HISTORY_LIMIT)
      .lean();
    const messages = docs.map((doc) => serializeMessage(doc));
    return Response.json({ success: true, messages });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id: rideId } = await params;
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const type = body.type === "location" ? "location" : "message";
    const coords =
      type === "location" && Array.isArray(body.coords) && body.coords.length === 2
        ? body.coords.map(Number)
        : [];

    if (type === "message" && !text) {
      return Response.json(
        { success: false, message: "Cannot send an empty message" },
        { status: 400 }
      );
    }
    if (type === "location" && coords.length !== 2) {
      return Response.json(
        { success: false, message: "Invalid location coordinates" },
        { status: 400 }
      );
    }
    if (text.length > 2000) {
      return Response.json(
        { success: false, message: "Message is too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    await connectDB();
    const ride = await Ride.findById(rideId).lean();
    if (!ride) {
      return Response.json({ success: false, message: "Ride not found" }, { status: 404 });
    }

    const requester = normalizeEmail(authResult.email);
    if (!isRideChatParticipant(ride, requester)) {
      return Response.json(
        { success: false, message: "You are not allowed to send messages in this chat" },
        { status: 403 }
      );
    }

    const userDoc = await User.findOne({ email: requester }).select("name").lean();
    const senderName = userDoc?.name || requester;

    const message = await publishUserMessage({
      rideId,
      text,
      type,
      coords,
      senderEmail: requester,
      senderName,
    });

    return Response.json({ success: true, message });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
