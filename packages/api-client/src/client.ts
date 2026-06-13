import { client } from "./generated/client.gen";

/**
 * A failed backend call. Carries the backend's machine-readable `code` (from the
 * global error handler — see Architecture/04) so callers and the QueryClient can
 * branch on it (e.g. retry only `rate_limited`) instead of string-matching.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Transient failures worth a retry; client (4xx) errors are not. */
  get retryable(): boolean {
    return this.code === "rate_limited" || this.status >= 500;
  }
}

/**
 * All requests go through the Next.js BFF proxy, which validates the auth
 * session and injects the internal service key before forwarding to FastAPI.
 */
export const API_BASE_URL = "/api/proxy";

client.setConfig({ baseUrl: API_BASE_URL });

// Map the backend's { code, message } error envelope to a typed ApiError. With
// throwOnError enabled, the value returned here is what the SDK call throws.
client.interceptors.error.use((error, response) => {
  const body = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
    detail?: unknown;
  };
  const code = typeof body.code === "string" ? body.code : "error";
  const message =
    (typeof body.message === "string" && body.message) ||
    (typeof body.detail === "string" && body.detail) ||
    response?.statusText ||
    "Request failed";
  return new ApiError(response?.status ?? 0, code, message);
});
