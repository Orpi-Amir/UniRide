import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";
import { publishSystemMessage } from "@/lib/rideMessages";

export async function POST(req) {
  try {
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    const { rideId, passengerEmail } = await req.json();
    if (!rideId || !passengerEmail) {
      return Response.json({ success: false, message: "Missing data" }, { status: 400 });
    }

    await connectDB();
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return Response.json({ success: false, message: "Ride not found" }, { status: 404 });
    }
    if ((ride.driver || "").toLowerCase().trim() !== authResult.email) {
      return Response.json(
        { success: false, message: "Only driver can decline bookings" },
        { status: 403 }
      );
    }

    const email = passengerEmail.toLowerCase().trim();
    const request = (ride.bookingRequests || []).find(
      (entry) => (entry.email || "").toLowerCase().trim() === email
    );
    if (!request || request.status !== "pending") {
      return Response.json(
        { success: false, message: "Pending booking request not found" },
        { status: 404 }
      );
    }

    ride.bookingRequests = (ride.bookingRequests || []).filter(
      (entry) => (entry.email || "").toLowerCase().trim() !== email
    );
    await ride.save();

    const passenger = await User.findOne({ email }).select("name").lean();
    const passengerName = passenger?.name || email;
    await publishSystemMessage(
      String(ride._id),
      `Driver declined ${passengerName}'s booking request.`
    );

    return Response.json({ success: true, message: "Booking request declined" });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
