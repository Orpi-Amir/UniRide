import dbConnect from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";

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
    await dbConnect();

    const body = await req.json();

    console.log("📥 Incoming ride:", body);

    const newRide = await Ride.create(body);

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