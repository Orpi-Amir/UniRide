import connectDB from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";

// GET all rides
export async function GET() {
  try {
    await connectDB();

    const rides = await Ride.find().sort({ createdAt: -1 });

    return Response.json({
      success: true,
      rides,
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: error.message,
    });
  }
}

// POST new ride
export async function POST(req) {
  try {
    await connectDB();

    const body = await req.json();

    const newRide = await Ride.create({
      driver: body.driver,
      from: body.from,
      to: body.to,
      date: body.date,
      time: body.time,
      seats: body.seats,
      price: body.price,
    });

    return Response.json({
      success: true,
      ride: newRide,
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: error.message,
    });
  }
}