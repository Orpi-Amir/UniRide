import connectDB from "@/lib/mongodb";
import User from "@/lib/models/User";
import { getAuthorizedUniversityUser } from "@/lib/serverAuth";

async function getOrCreateUser() {
  const authResult = await getAuthorizedUniversityUser();
  if (authResult.error) return authResult;

  await connectDB();

  const user = await User.findOneAndUpdate(
    { clerkId: authResult.userId },
    {
      $set: {
        email: authResult.email,
        image: authResult.clerkUser?.imageUrl || "",
      },
      $setOnInsert: {
        name: authResult.clerkUser?.fullName || "User",
        university: "",
        phone: "",
        bio: "",
      },
    },
    { new: true, upsert: true }
  );

  return { user };
}

export async function GET() {
  try {
    const result = await getOrCreateUser();
    if (result.error) {
      return Response.json({ success: false, message: result.error }, { status: result.status });
    }
    return Response.json({ success: true, user: result.user });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const result = await getOrCreateUser();
    if (result.error) {
      return Response.json({ success: false, message: result.error }, { status: result.status });
    }

    const body = await req.json();
    const updates = {
      name: (body.fullName || "").trim() || result.user.name,
      university: (body.university || "").trim(),
      phone: (body.phone || "").trim(),
      bio: (body.bio || "").trim(),
    };

    const user = await User.findByIdAndUpdate(result.user._id, updates, { new: true });
    return Response.json({ success: true, user });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
