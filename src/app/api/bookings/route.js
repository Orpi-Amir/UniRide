import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";
import Ably from "ably";

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

    if ((ride.driver || "").toLowerCase().trim() === authResult.email) {
      return Response.json({
        success: false,
        message: "You cannot book your own ride",
      });
    }

    const alreadyRequested = (ride.bookingRequests || []).some(
      (request) => (request.email || "").toLowerCase().trim() === authResult.email
    );
    const alreadyBooked = (ride.bookedUsers || []).some(
      (email) => (email || "").toLowerCase().trim() === authResult.email
    );
    if (alreadyRequested || alreadyBooked) {
      return Response.json({
        success: false,
        message: "You already requested or booked this ride",
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

    const updatedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        driver: { $ne: authResult.email },
      },
      {
        $push: {
          bookingRequests: {
            email: authResult.email,
            pickupLabel: typeof pickupLabel === "string" ? pickupLabel.trim() : "",
            pickupCoords: Array.isArray(pickupCoords) ? pickupCoords : [],
            status: "pending",
            requestedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updatedRide) {
      return Response.json({
        success: false,
        message: "Booking request unavailable",
      });
    }

    try {
      if (process.env.ABLY_API_KEY) {
        const ably = new Ably.Rest(process.env.ABLY_API_KEY);
        await ably.channels.get(`ride:${String(ride._id)}`).publish("message", {
          type: "system",
          text: `${authResult.email} requested to join this ride. Driver can accept in My Rides.`,
          sender: "System",
          senderEmail: "system",
        });
      }
    } catch {}

    return Response.json({
      success: true,
      message: "Booking request sent. Wait for driver acceptance.",
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: error.message,
    });
  }
}