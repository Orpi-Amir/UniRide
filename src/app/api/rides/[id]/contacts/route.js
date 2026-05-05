import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

function toContact(user) {
  if (!user) return null;
  return {
    name: user.name || "User",
    email: user.email || "",
    phone: user.phone || "",
  };
}

function haversineDistanceKm(fromCoords, toCoords) {
  if (!Array.isArray(fromCoords) || !Array.isArray(toCoords)) return null;
  const [lat1, lng1] = fromCoords;
  const [lat2, lng2] = toCoords;
  if ([lat1, lng1, lat2, lng2].some((value) => typeof value !== "number")) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export async function GET(req, { params }) {
  try {
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    await connectDB();

    const ride = await Ride.findById(params.id);
    if (!ride) {
      return Response.json({ success: false, message: "Ride not found" }, { status: 404 });
    }

    const requesterEmail = authResult.email;
    const isDriver = ride.driver === requesterEmail;
    const isPassenger = (ride.bookedUsers || []).includes(requesterEmail);

    if (!isDriver && !isPassenger) {
      return Response.json(
        { success: false, message: "You are not authorized to view contacts for this ride" },
        { status: 403 }
      );
    }

    const driver = await User.findOne({ email: ride.driver }).lean();

    if (isPassenger) {
      const pickup = (ride.passengerPickups || []).find((entry) => entry.email === requesterEmail);
      const pickupDistanceFromDriverStartKm = haversineDistanceKm(
        ride.fromCoords,
        pickup?.coords
      );
      return Response.json({
        success: true,
        contactType: "driver",
        rideId: ride._id,
        contact: toContact(driver),
        pickup: pickup
          ? {
              label: pickup.label || "",
              coords: pickup.coords || [],
              distanceFromDriverStartKm: pickupDistanceFromDriverStartKm,
            }
          : null,
      });
    }

    const passengerEmails = ride.bookedUsers || [];
    const passengers = await User.find({ email: { $in: passengerEmails } })
      .select("name email phone")
      .lean();

    const pickupByEmail = new Map(
      (ride.passengerPickups || []).map((pickup) => [pickup.email, pickup])
    );
    const passengersWithPickup = passengers.map((p) => {
      const pickup = pickupByEmail.get(p.email);
      return {
        ...toContact(p),
        pickupLabel: pickup?.label || "",
        pickupCoords: pickup?.coords || [],
        distanceFromDriverStartKm: haversineDistanceKm(ride.fromCoords, pickup?.coords),
      };
    });

    return Response.json({
      success: true,
      contactType: "passengers",
      rideId: ride._id,
      contact: toContact(driver),
      passengers: passengersWithPickup,
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
