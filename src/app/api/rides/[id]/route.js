import dbConnect from "@/lib/mongodb";
import Ride from "@/lib/models/Ride";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

export async function DELETE(req, { params }) {
  try {
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    await dbConnect();
    const ride = await Ride.findById(params.id);

    if (!ride) {
      return Response.json({ success: false, message: "Ride not found" }, { status: 404 });
    }

    if (ride.driver !== authResult.email) {
      return Response.json(
        { success: false, message: "You can only delete your own ride" },
        { status: 403 }
      );
    }

    await Ride.findByIdAndDelete(params.id);
    return Response.json({ success: true, message: "Ride deleted successfully" });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
