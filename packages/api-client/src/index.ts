// Public surface of @repo/api-client. Importing this module also configures the
// generated client (base URL + error interceptor) via the side-effecting import
// below — keep it first.
import "./client";

export { ApiError, API_BASE_URL } from "./client";

// Generated from apps/api/openapi.json (do not hand-edit src/generated).
export * from "./generated/types.gen";
export * from "./generated/sdk.gen";
