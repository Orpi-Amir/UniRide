import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";
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

    const email = authResult.email;
    const isDriver = ride.driver === email;
    const isPassenger = (ride.bookedUsers || []).includes(email);

    if (!isDriver && !isPassenger) {
      return Response.json(
        { success: false, message: "You are not allowed to join this ride chat" },
        { status: 403 }
      );
    }

    const rest = new Ably.Rest(ablyApiKey);
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: email,
      capability: {
        [`ride:${ride._id}`]: ["publish", "subscribe", "history", "presence"],
      },
    });

    return Response.json({
      success: true,
      channelName: `ride:${ride._id}`,
      clientId: email,
      tokenRequest,
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
