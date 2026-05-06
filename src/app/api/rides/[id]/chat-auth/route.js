import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";
import { isRideChatParticipant } from "@/lib/rideParticipant";
import { parseAblyRootKey } from "@/lib/ablyRootKey";
import Ably from "ably";

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

    const ablyParsed = parseAblyRootKey(process.env.ABLY_API_KEY);
    if (!ablyParsed.ok) {
      return Response.json(
        { success: false, message: ablyParsed.error },
        { status: 500 }
      );
    }

    await connectDB();

    const ride = await Ride.findById(rideId).lean();
    if (!ride) {
      return Response.json({ success: false, message: "Ride not found" }, { status: 404 });
    }

    const email = authResult.email.toLowerCase().trim();
    if (!isRideChatParticipant(ride, email)) {
      return Response.json(
        { success: false, message: "You are not allowed to join this ride chat" },
        { status: 403 }
      );
    }

    const rideChannelKey = `ride:${String(ride._id)}`;

    // Ably clientId allows only [a-zA-Z0-9_-] — emails contain @ and "." and break the connection.
    const ablyClientId = authResult.userId.replace(/[^a-zA-Z0-9_-]/g, "_");

    const rest = new Ably.Rest(ablyParsed.key);
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: ablyClientId,
      capability: {
        [rideChannelKey]: ["publish", "subscribe", "history", "presence"],
      },
    });

    return Response.json({
      success: true,
      channelName: rideChannelKey,
      ablyClientId,
      userEmail: email,
      tokenRequest,
    });
  } catch (error) {
    const raw = error?.message || "Chat authentication failed";
    const lower = String(raw).toLowerCase();
    const message =
      lower.includes("key") || lower.includes("401") || lower.includes("credential")
        ? `${raw} Check ABLY_API_KEY in Vercel (or .env.local): use the full Ably root key APP_ID.KEY_ID:SECRET with no spaces or quotes.`
        : raw;
    return Response.json({ success: false, message }, { status: 500 });
  }
}
