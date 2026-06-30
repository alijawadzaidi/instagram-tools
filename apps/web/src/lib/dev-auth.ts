/**
 * Reusable dev auth bypass.
 *
 * When `AUTH_DISABLED=true` (and NOT a production build), the app runs with no
 * authentication: the middleware lets every route through, and the BFF proxy
 * attributes requests to `DEV_USER_ID` instead of resolving a better-auth
 * session — so the frontend needs no Google OAuth and the backend needs no DB
 * session to try the tools end to end.
 *
 * Hard-guarded by `NODE_ENV`: a production build can never bypass auth, even if
 * `AUTH_DISABLED` is set. The matching backend guard lives in
 * `apps/api/app/core/config.py` (`settings.auth_bypassed`); one shared env var
 * drives both apps, e.g. `AUTH_DISABLED=true pnpm dev`.
 */
export const DEV_USER_ID = "dev-user";

export function isAuthBypassed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_DISABLED === "true"
  );
}
