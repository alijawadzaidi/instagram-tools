import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

import { isAuthBypassed } from "@/lib/dev-auth";

export function middleware(request: NextRequest) {
  // Dev bypass: when AUTH_DISABLED=true (non-prod only), skip the sign-in gate.
  if (isAuthBypassed()) return NextResponse.next();

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
