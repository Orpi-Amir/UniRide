import dbConnect from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

export async function GET() {
  try {
    await dbConnect();

    const rides = await Ride.find({});

    return Response.json({
      success: true,
      rides,
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