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

  const email = clerkUser.emailAddresses[0]?.emailAddress;

  let user = await User.findOne({ email });

  if (!user) {
    console.log("🆕 Creating new MongoDB user");

    user = await User.create({
      name: clerkUser.fullName || "User",
      email: email,
      image: clerkUser.imageUrl,
      rides: [],
    });
  } else {
    console.log("✅ User already exists in DB");
  }

  return user;
}