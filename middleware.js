import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",                   // public homepage
  "/auth/login(.*)",     // login page
  "/auth/signup(.*)",    // signup page
  "/verify-email(.*)",   // email verification page
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // apply to everything except static assets and Next's internal files
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
