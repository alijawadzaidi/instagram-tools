import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Protect everything except the auth pages, API routes, Next.js internals,
  // and the ungated /tasks checklist.
  matcher: ["/((?!sign-in|api|_next|favicon|tasks).*)"],
};
