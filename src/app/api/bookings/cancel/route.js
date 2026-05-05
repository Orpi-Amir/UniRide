import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

export async function POST(req) {
  try {
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    await connectDB();

    const { rideId } = await req.json();

    if (!rideId) {
      return Response.json({
        success: false,
        message: "Missing data",
      });
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return Response.json({
        success: false,
        message: "Ride not found",
      });
    }

    if (!(ride.bookedUsers || []).includes(authResult.email)) {
      return Response.json({
        success: false,
        message: "You do not have a booking on this ride",
      });
    }

    await Ride.findOneAndUpdate(
      { _id: rideId, bookedUsers: authResult.email },
      {
        $pull: {
          bookedUsers: authResult.email,
          passengerPickups: { email: authResult.email },
        },
        $inc: { seats: 1 },
      }
    );

    return Response.json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: error.message,
    });
  }
}