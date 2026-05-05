import connectDB from "@/lib/mongodb";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

export async function POST() {
  try {
    const authResult = await getAuthorizedUniversityUser();
    if (authResult.error) {
      return Response.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      );
    }

    await connectDB();

    const user = await User.findOneAndUpdate(
      { clerkId: authResult.userId },
      {
        $set: {
          email: authResult.email,
          name: authResult.clerkUser?.fullName || "User",
          image: authResult.clerkUser?.imageUrl || "",
        },
        $setOnInsert: {
          university: "",
          phone: "",
          bio: "",
        },
      },
      { new: true, upsert: true }
    );

    return Response.json({ success: true, user });
  } catch (error) {
    return Response.json(
      { success: false, message: error.message || "Failed to sync user" },
      { status: 500 }
    );
  }
}
