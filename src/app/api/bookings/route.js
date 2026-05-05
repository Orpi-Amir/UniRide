import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

// BOOK A RIDE
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

    const { rideId, pickupCoords, pickupLabel } = await req.json();

    if (!rideId) {
      return Response.json({
        success: false,
        message: "Missing data",
      });
    }

    const hasValidPickupCoords =
      !pickupCoords ||
      (Array.isArray(pickupCoords) &&
        pickupCoords.length === 2 &&
        pickupCoords.every((value) => typeof value === "number"));
    if (!hasValidPickupCoords) {
      return Response.json({
        success: false,
        message: "Invalid pickup location coordinates",
      });
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return Response.json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.driver === authResult.email) {
      return Response.json({
        success: false,
        message: "You cannot book your own ride",
      });
    }

    const passenger = await User.findOne({ email: authResult.email }).select("phone").lean();
    const driver = await User.findOne({ email: ride.driver }).select("phone").lean();
    if (!passenger?.phone?.trim()) {
      return Response.json({
        success: false,
        message: "Please add your phone number in your profile before booking rides.",
      });
    }
    if (!driver?.phone?.trim()) {
      return Response.json({
        success: false,
        message: "Driver contact is unavailable right now. Please choose another ride.",
      });
    }

    const pickupEntry = {
      email: authResult.email,
      label: typeof pickupLabel === "string" ? pickupLabel.trim() : "",
      coords: Array.isArray(pickupCoords) ? pickupCoords : [],
      updatedAt: new Date(),
    };

    const updatedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        driver: { $ne: authResult.email },
        seats: { $gt: 0 },
        bookedUsers: { $ne: authResult.email },
      },
      {
        $inc: { seats: -1 },
        $push: { bookedUsers: authResult.email },
        $pull: { passengerPickups: { email: authResult.email } },
      },
      { new: true }
    );

    if (!updatedRide) {
      return Response.json({
        success: false,
        message: "Booking unavailable (no seats left or already booked)",
      });
    }

    updatedRide.passengerPickups = [...(updatedRide.passengerPickups || []), pickupEntry];
    await updatedRide.save();

    return Response.json({
      success: true,
      message: "Ride booked successfully",
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: error.message,
    });
  }
}