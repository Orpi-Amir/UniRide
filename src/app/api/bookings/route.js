import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import mongoose from "mongoose";

// BOOK A RIDE
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

    // find ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return Response.json({
        success: false,
        message: "Ride not found",
      });
    }

    // check seats
    if (ride.seats <= 0) {
      return Response.json({
        success: false,
        message: "No seats available",
      });
    }

    // OPTIONAL: prevent same user booking multiple times
    const alreadyBooked = ride.bookedUsers?.includes(userEmail);

    if (alreadyBooked) {
      return Response.json({
        success: false,
        message: "You already booked this ride",
      });
    }

    // reduce seat
    ride.seats -= 1;

    // track user (add field dynamically)
    if (!ride.bookedUsers) {
      ride.bookedUsers = [];
    }

    ride.bookedUsers.push(userEmail);

    await ride.save();

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