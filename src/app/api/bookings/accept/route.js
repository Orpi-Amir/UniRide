import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";
import Ably from "ably";

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
      return Response.json({ success: false, message: "Only driver can accept bookings" }, { status: 403 });
    }
    if (ride.seats <= 0) {
      return Response.json({ success: false, message: "No seats left to accept this request" }, { status: 400 });
    }

    const email = passengerEmail.toLowerCase().trim();
    const request = (ride.bookingRequests || []).find((entry) => (entry.email || "").toLowerCase().trim() === email);
    if (!request || request.status !== "pending") {
      return Response.json({ success: false, message: "Pending booking request not found" }, { status: 404 });
    }

    request.status = "accepted";
    request.decidedAt = new Date();
    if (!(ride.bookedUsers || []).some((entry) => (entry || "").toLowerCase().trim() === email)) {
      ride.bookedUsers.push(email);
      ride.seats = Math.max((ride.seats || 0) - 1, 0);
    }
    ride.passengerPickups = [
      ...(ride.passengerPickups || []).filter((entry) => (entry.email || "").toLowerCase().trim() !== email),
      {
        email,
        label: request.pickupLabel || "",
        coords: request.pickupCoords || [],
        updatedAt: new Date(),
      },
    ];
    await ride.save();

    try {
      if (process.env.ABLY_API_KEY) {
        const ably = new Ably.Rest(process.env.ABLY_API_KEY);
        await ably.channels.get(`ride:${String(ride._id)}`).publish("message", {
          type: "system",
          text: `Driver accepted ${email}'s booking request. You can now chat and share live location.`,
          sender: "System",
          senderEmail: "system",
        });
      }
    } catch {}

    return Response.json({ success: true, message: "Booking request accepted" });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
