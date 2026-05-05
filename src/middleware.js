import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/login(.*)",
  "/auth/signup(.*)",
  "/auth/not-university(.*)",
  "/verify-email(.*)",
]);

function pickPrimaryEmail(user) {
  const addresses = user?.emailAddresses || [];
  const primaryId = user?.primaryEmailAddressId;
  const primary = addresses.find((e) => e.id === primaryId);
  if (primary?.emailAddress) return primary.emailAddress;

  const verified = addresses.find((e) => e.verification?.status === "verified");
  if (verified?.emailAddress) return verified.emailAddress;

  return addresses[0]?.emailAddress || "";
}

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (userId) {
    const email = pickPrimaryEmail(await (await clerkClient()).users.getUser(userId));
    const allowed = email && isValidUniversityEmail(email);

    if (!allowed) {
      const isApi = req.nextUrl.pathname.startsWith("/api");
      if (isApi) {
        return NextResponse.json(
          { success: false, message: "University email required" },
          { status: 403 }
        );
      }

      if (!req.nextUrl.pathname.startsWith("/auth/not-university")) {
        return NextResponse.redirect(new URL("/auth/not-university", req.url));
      }
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
