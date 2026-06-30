import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

const FASTAPI_URL = process.env.INTERNAL_API_URL ?? "http://localhost:8000";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? "";

// Generous because bulk zip downloads legitimately stream for minutes.
const UPSTREAM_TIMEOUT_MS = 5 * 60 * 1000;

// Session lookups hit Postgres, and polling tools call the proxy every ~2s.
// Cache cookie -> user briefly so each poll tick doesn't pay a DB round-trip.
// Tradeoff: a revoked session stays valid here for up to the TTL.
const SESSION_TTL_MS = 60 * 1000;
const sessionCache = new Map<string, { userId: string; expires: number }>();

async function getUserId(request: NextRequest): Promise<string | null> {
  // TEMP: auth bypassed in development for local browsing (no DB / OAuth needed).
  // Production still resolves the real session. Delete this line to require it in dev.
  if (process.env.NODE_ENV !== "production") return "dev-user";

  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  const cached = sessionCache.get(cookie);
  if (cached && cached.expires > Date.now()) return cached.userId;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  if (sessionCache.size > 1000) sessionCache.clear(); // crude but sufficient bound
  sessionCache.set(cookie, {
    userId: session.user.id,
    expires: Date.now() + SESSION_TTL_MS,
  });
  return session.user.id;
}

function errorJson(code: string, message: string, status: number): Response {
  // `detail` mirrors `message` for the current client; dropped in Phase 3.
  return Response.json({ code, message, detail: message }, { status });
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const userId = await getUserId(request);
  if (!userId) {
    return errorJson("unauthorized", "Unauthorized", 401);
  }

  const { path } = await params;
  const url = new URL(request.url);
  const targetUrl = `${FASTAPI_URL}/${path.join("/")}${url.search}`;

  const forwardHeaders = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) forwardHeaders.set("content-type", contentType);
  forwardHeaders.set("x-internal-key", INTERNAL_KEY);
  forwardHeaders.set("x-user-id", userId);
  const requestId = request.headers.get("x-request-id");
  if (requestId) forwardHeaders.set("x-request-id", requestId);

  const init: RequestInit & { duplex?: string } = {
    method: request.method,
    headers: forwardHeaders,
    // Abort upstream work when the client disconnects OR the timeout fires.
    signal: AbortSignal.any([
      request.signal,
      AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    ]),
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return errorJson(
        "upstream_timeout",
        "The backend took too long to respond.",
        504,
      );
    }
    if (request.signal.aborted) throw err; // client went away; nothing to answer
    return errorJson("upstream_unreachable", "The backend is unreachable.", 502);
  }

  const responseHeaders = new Headers(upstream.headers);
  // Strip hop-by-hop headers that must not be forwarded
  responseHeaders.delete("connection");
  responseHeaders.delete("keep-alive");
  responseHeaders.delete("transfer-encoding");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
