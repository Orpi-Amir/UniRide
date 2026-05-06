import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";
import { isRideChatParticipant } from "@/lib/rideParticipant";
import Ably from "ably";

export async function GET(req, { params }) {
  try {
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    const ablyApiKey = process.env.ABLY_API_KEY;
    if (!ablyApiKey) {
      return Response.json(
        { success: false, message: "ABLY_API_KEY is missing in environment variables" },
        { status: 500 }
      );
    }

    await connectDB();

    const ride = await Ride.findById(params.id).lean();
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

    const rest = new Ably.Rest(ablyApiKey);
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
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
