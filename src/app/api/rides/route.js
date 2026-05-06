import dbConnect from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

export async function GET() {
  try {
    await dbConnect();

    const rides = await Ride.find({}).lean();
    const driverEmails = [...new Set(rides.map((ride) => ride.driver).filter(Boolean))];
    const drivers = await User.find({ email: { $in: driverEmails } }).select("email gender").lean();
    const genderByEmail = new Map(drivers.map((driver) => [driver.email, driver.gender || "any"]));
    const ridesWithDriverGender = rides.map((ride) => ({
      ...ride,
      driverGender: ride.driverGender || genderByEmail.get(ride.driver) || "any",
    }));

    return Response.json({
      success: true,
      rides: ridesWithDriverGender,
    });
  } catch (error) {
    console.error("❌ GET rides error:", error);

    return Response.json({
      success: false,
      message: "Failed to fetch rides",
    });
  }
}

export async function POST(req) {
  try {
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    await dbConnect();

    const body = await req.json();
    const hasValidFromCoords =
      !body.fromCoords ||
      (Array.isArray(body.fromCoords) &&
        body.fromCoords.length === 2 &&
        body.fromCoords.every((value) => typeof value === "number"));
    const hasValidToCoords =
      !body.toCoords ||
      (Array.isArray(body.toCoords) &&
        body.toCoords.length === 2 &&
        body.toCoords.every((value) => typeof value === "number"));

    if (!hasValidFromCoords || !hasValidToCoords) {
      return Response.json(
        { success: false, message: "Invalid map coordinates" },
        { status: 400 }
      );
    }
    if (!body.from?.trim() || !body.to?.trim() || !body.date || !body.time) {
      return Response.json(
        { success: false, message: "From, to, date, and time are required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(Number(body.seats)) || Number(body.seats) < 1) {
      return Response.json(
        { success: false, message: "Seats must be at least 1" },
        { status: 400 }
      );
    }

    console.log("📥 Incoming ride:", body);

    const newRide = await Ride.create({
      ...body,
      driver: authResult.email,
      driverGender:
        (await User.findOne({ email: authResult.email }).select("gender").lean())?.gender || "any",
    });

    console.log("✅ Ride saved:", newRide);

    return Response.json({
      success: true,
      ride: newRide,
    });
  } catch (error) {
    console.error("❌ POST ride error:", error);

    return Response.json({
      success: false,
      message: "Failed to create ride",
    });
  }
}