import { currentUser } from "@clerk/nextjs/server";
import User from "@/lib/models/User";
import connectDB from "@/lib/mongodb";

export async function syncUserToDB() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    console.log("❌ No Clerk user found");
    return null;
  }

  await connectDB();

  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  const updatedUser = await User.findOneAndUpdate(
    { clerkId: clerkUser.id },
    {
      $set: {
        email,
        name: clerkUser.fullName || "User",
        image: clerkUser.imageUrl || "",
      },
      $setOnInsert: {
        university: "",
        phone: "",
        bio: "",
      },
    },
    { new: true, upsert: true }
  );

  return updatedUser;
}