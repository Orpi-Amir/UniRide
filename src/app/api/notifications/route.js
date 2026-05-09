import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

function normEmail(value) {
  return (value || "").toLowerCase().trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET() {
  try {
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    await connectDB();

    const me = normEmail(authResult.email);
    const emailPattern = new RegExp(`^${escapeRegex(me)}$`, "i");
    const rides = await Ride.find({
      $or: [
        { driver: emailPattern },
        { bookedUsers: emailPattern },
        { "bookingRequests.email": emailPattern },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const items = [];

    for (const ride of rides) {
      const rideId = String(ride._id);
      const driverEmail = normEmail(ride.driver);
      const isDriver = driverEmail === me;
      const route = `${ride.from} → ${ride.to}`;

      if (isDriver) {
        for (const req of ride.bookingRequests || []) {
          const status = (req.status || "pending").toLowerCase();
          if (status === "pending") {
            items.push({
              id: `${rideId}-req-${normEmail(req.email)}`,
              type: "booking_request",
              title: "New booking request",
              message: `${normEmail(req.email)} wants to join your ride (${route}).`,
              rideId,
              passengerEmail: normEmail(req.email),
              actionable: true,
              createdAt: req.requestedAt || ride.updatedAt,
            });
          }
        }
      }

      for (const req of ride.bookingRequests || []) {
        if (normEmail(req.email) !== me) continue;
        const status = (req.status || "pending").toLowerCase();
        if (status === "pending") {
          items.push({
            id: `${rideId}-waiting`,
            type: "waiting_driver",
            title: "Waiting for driver",
            message: `Your request for ${route} is pending acceptance.`,
            rideId,
            createdAt: req.requestedAt || ride.updatedAt,
          });
        }
        if (status === "accepted") {
          items.push({
            id: `${rideId}-accepted-${me}`,
            type: "booking_accepted",
            title: "Booking accepted",
            message: `Your seat on ${route} is confirmed. Open the chat to coordinate pickup.`,
            rideId,
            createdAt: req.decidedAt || ride.updatedAt,
          });
        }
      }
    }

    const dedup = new Map();
    for (const item of items) {
      dedup.set(item.id, item);
    }
    const notifications = [...dedup.values()].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    const unreadHint = notifications.filter(
      (n) =>
        n.type === "booking_request" ||
        n.type === "waiting_driver" ||
        n.type === "booking_accepted"
    ).length;

    return Response.json({
      success: true,
      notifications,
      unreadHint,
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
