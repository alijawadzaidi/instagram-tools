import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

const FASTAPI_URL = process.env.INTERNAL_API_URL ?? "http://localhost:8000";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? "";

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const url = new URL(request.url);
  const targetUrl = `${FASTAPI_URL}/${path.join("/")}${url.search}`;

  const forwardHeaders = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) forwardHeaders.set("content-type", contentType);
  forwardHeaders.set("x-internal-key", INTERNAL_KEY);
  forwardHeaders.set("x-user-id", session.user.id);

  const init: RequestInit & { duplex?: string } = {
    method: request.method,
    headers: forwardHeaders,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(targetUrl, init);

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
