import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";
import { isRideChatParticipant, normalizeEmail } from "@/lib/rideParticipant";

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

    const requesterEmail = normalizeEmail(authResult.email);
    const isDriver = normalizeEmail(ride.driver) === requesterEmail;

    if (!isRideChatParticipant(ride, requesterEmail)) {
      return Response.json(
        { success: false, message: "You are not authorized to view contacts for this ride" },
        { status: 403 }
      );
    }

    const driver = await User.findOne({ email: ride.driver }).lean();

    if (!isDriver) {
      const pickupSaved = (ride.passengerPickups || []).find(
        (entry) => normalizeEmail(entry.email) === requesterEmail
      );
      const requestEntry = (ride.bookingRequests || []).find(
        (entry) => normalizeEmail(entry.email) === requesterEmail && entry.status !== "rejected"
      );
      const coords =
        pickupSaved?.coords?.length === 2
          ? pickupSaved.coords
          : requestEntry?.pickupCoords?.length === 2
            ? requestEntry.pickupCoords
            : [];
      const label = pickupSaved?.label || requestEntry?.pickupLabel || "";
      const pickup =
        coords.length === 2 || label
          ? { label, coords, email: requesterEmail }
          : null;
      const pickupDistanceFromDriverStartKm = haversineDistanceKm(ride.fromCoords, pickup?.coords);
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

    const bookedSet = new Set((ride.bookedUsers || []).map((e) => normalizeEmail(e)));
    const pendingEmails = (ride.bookingRequests || [])
      .filter((r) => (r.status || "pending").toLowerCase() === "pending")
      .map((r) => normalizeEmail(r.email));
    const passengerEmails = [
      ...new Set([...(ride.bookedUsers || []).map(normalizeEmail), ...pendingEmails]),
    ].filter(Boolean);

    const passengers = await User.find({
      email: { $in: passengerEmails },
    })
      .select("name email phone")
      .lean();

    const pickupByEmail = new Map(
      (ride.passengerPickups || []).map((pickup) => [
        normalizeEmail(pickup.email),
        pickup,
      ])
    );
    const requestByEmail = new Map(
      (ride.bookingRequests || []).map((r) => [normalizeEmail(r.email), r])
    );

    const passengersWithPickup = passengerEmails.map((emailKey) => {
      const userDoc = passengers.find((p) => normalizeEmail(p.email) === emailKey);
      const pickup = pickupByEmail.get(emailKey);
      const req = requestByEmail.get(emailKey);
      const coords =
        pickup?.coords?.length === 2
          ? pickup.coords
          : req?.pickupCoords?.length === 2
            ? req.pickupCoords
            : [];
      const pickupLabel = pickup?.label || req?.pickupLabel || "";
      const confirmed = bookedSet.has(emailKey);
      const base = userDoc
        ? toContact(userDoc)
        : { name: emailKey.split("@")[0] || "Passenger", email: emailKey, phone: "" };
      return {
        ...base,
        bookingStatus: confirmed ? "confirmed" : "pending",
        pickupLabel,
        pickupCoords: coords,
        distanceFromDriverStartKm: haversineDistanceKm(ride.fromCoords, coords),
      };
    });

    passengersWithPickup.sort((a, b) => {
      if (a.bookingStatus === b.bookingStatus) return 0;
      return a.bookingStatus === "confirmed" ? -1 : 1;
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
