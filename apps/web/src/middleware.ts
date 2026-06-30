import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  // TEMP: auth bypassed in development for local browsing (no DB / OAuth needed).
  // Production still enforces. Delete this line to require sign-in in dev too.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Only the dashboard is gated. The landing page (/), sign-in, API routes,
  // Next.js internals, and the /tasks checklist are all public.
  matcher: ["/dashboard/:path*"],
};
