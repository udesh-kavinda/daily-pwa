import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/setup(.*)",
]);

const isClerkConfigured = () => {
  return (
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_your_key_here" &&
    process.env.CLERK_SECRET_KEY &&
    process.env.CLERK_SECRET_KEY !== "sk_test_your_key_here"
  );
};

const proxy = clerkMiddleware(async (auth, req) => {
  if (!isClerkConfigured()) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith("/setup")) {
      url.pathname = "/setup";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
