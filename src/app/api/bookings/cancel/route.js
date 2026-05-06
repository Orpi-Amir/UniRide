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

    const me = authResult.email.toLowerCase().trim();
    const booked = (ride.bookedUsers || []).some((e) => (e || "").toLowerCase().trim() === me);
    if (!booked) {
      return Response.json({
        success: false,
        message: "You do not have a booking on this ride",
      });
    }

    ride.bookedUsers = (ride.bookedUsers || []).filter((e) => (e || "").toLowerCase().trim() !== me);
    ride.passengerPickups = (ride.passengerPickups || []).filter(
      (entry) => (entry.email || "").toLowerCase().trim() !== me
    );
    ride.seats = Math.max((ride.seats || 0) + 1, 0);
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