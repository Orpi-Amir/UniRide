import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

export async function GET(req, { params }) {
  try {
    const { id: rideId } = await params;

    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    await connectDB();
    const ride = await Ride.findById(rideId).lean();
    if (!ride) {
      return Response.json({ success: false, message: "Ride not found" }, { status: 404 });
    }

    const me = authResult.email.toLowerCase().trim();
    const isDriver = (ride.driver || "").toLowerCase().trim() === me;
    const isPassenger = (ride.bookedUsers || []).some(
      (entry) => (entry || "").toLowerCase().trim() === me
    );
    if (!isDriver && !isPassenger) {
      return Response.json(
        { success: false, message: "You are not allowed to view live tracking for this ride" },
        { status: 403 }
      );
    }

    return Response.json({
      success: true,
      rideId: ride._id,
      driver: ride.driver,
      liveLocation: {
        coords: ride.driverLiveLocation?.coords || [],
        updatedAt: ride.driverLiveLocation?.updatedAt || null,
      },
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id: rideId } = await params;

    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    const { coords } = await req.json();
    const hasValidCoords =
      Array.isArray(coords) && coords.length === 2 && coords.every((value) => typeof value === "number");
    if (!hasValidCoords) {
      return Response.json(
        { success: false, message: "Invalid live location coordinates" },
        { status: 400 }
      );
    }

    await connectDB();
    const ride = await Ride.findById(rideId).lean();
    if (!ride) {
      return Response.json({ success: false, message: "Ride not found" }, { status: 404 });
    }
    const me = authResult.email.toLowerCase().trim();
    if ((ride.driver || "").toLowerCase().trim() !== me) {
      return Response.json(
        { success: false, message: "Only the driver can publish live location" },
        { status: 403 }
      );
    }

    await Ride.updateOne(
      { _id: rideId, driver: ride.driver },
      {
        $set: {
          driverLiveLocation: {
            coords,
            updatedAt: new Date(),
          },
        },
      }
    );

    return Response.json({ success: true, message: "Live location updated" });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
