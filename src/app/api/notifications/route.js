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
      $or: [{ driver: emailPattern }, { bookedUsers: emailPattern }, { "bookingRequests.email": emailPattern }],
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const items = [];

    for (const ride of rides) {
      const rideId = String(ride._id);
      const driverEmail = normEmail(ride.driver);
      const isDriver = driverEmail === me;

      if (isDriver) {
        for (const req of ride.bookingRequests || []) {
          if ((req.status || "pending") === "pending") {
            items.push({
              id: `${rideId}-req-${normEmail(req.email)}`,
              type: "booking_request",
              title: "New booking request",
              message: `${normEmail(req.email)} wants to join your ride (${ride.from} → ${ride.to}).`,
              rideId,
              createdAt: req.requestedAt || ride.updatedAt,
            });
          }
        }
      }

      for (const req of ride.bookingRequests || []) {
        if (normEmail(req.email) === me && (req.status || "pending") === "pending") {
          items.push({
            id: `${rideId}-waiting`,
            type: "waiting_driver",
            title: "Waiting for driver",
            message: `Your request for ${ride.from} → ${ride.to} is pending acceptance.`,
            rideId,
            createdAt: req.requestedAt || ride.updatedAt,
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

    return Response.json({
      success: true,
      notifications,
      unreadHint:
        notifications.filter((n) => n.type === "booking_request" || n.type === "waiting_driver").length,
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
