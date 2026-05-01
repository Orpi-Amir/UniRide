import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";

export async function POST(req) {
  try {
    await connectDB();

    const { rideId, userEmail } = await req.json();

    if (!rideId || !userEmail) {
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

    // remove user from bookedUsers
    ride.bookedUsers = (ride.bookedUsers || []).filter(
      (email) => email !== userEmail
    );

    // restore seat
    ride.seats += 1;

    await ride.save();

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