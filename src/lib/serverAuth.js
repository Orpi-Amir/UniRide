import { auth, currentUser } from "@clerk/nextjs/server";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";

export async function getAuthorizedUniversityUser() {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized", status: 401 };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase().trim();
  if (!email) {
    return { error: "Missing user email", status: 400 };
  }

  if (!isValidUniversityEmail(email)) {
    return { error: "Access denied: only approved university emails are allowed", status: 403 };
  }

  return { userId, email, clerkUser };
}
