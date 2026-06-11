# Auth — Google OAuth + a BFF proxy that fronts FastAPI

Two layers of auth, owned by two different parts of the stack:

1. **User auth** lives entirely in the Next.js app (`apps/web`) via **Better Auth**
   with Google as the only social provider. Sessions are cookie-based and stored
   in Postgres.
2. **Service auth** protects the Python backend (`apps/api`). FastAPI never trusts
   the browser directly — it only accepts requests carrying a shared
   `X-Internal-Key`, which only the Next.js proxy knows.

The browser therefore never talks to FastAPI. It talks to Next.js, Next.js
validates the user's session, then forwards to FastAPI with the internal key.

## The pieces

```
apps/web/
├── src/lib/auth.ts                       # Better Auth server instance (Google + pg)
├── src/lib/auth-client.ts                # Better Auth React client (useSession, signIn, signOut)
├── src/middleware.ts                     # route guard — redirects logged-out users to /sign-in
├── src/app/api/auth/[...all]/route.ts    # Better Auth's own endpoints (incl. OAuth callback)
├── src/app/api/proxy/[...path]/route.ts  # the BFF: validates session → forwards to FastAPI
├── src/app/(auth)/sign-in/page.tsx       # "Continue with Google" screen
└── src/components/app-sidebar.tsx        # shows the signed-in user + sign-out button

apps/api/
├── app/config.py                         # reads internal_api_key from env
└── app/shared/auth.py                    # require_internal_key dependency (401 if absent/wrong)
```

## Login flow (happy path)

```
Browser                Next.js (apps/web)              Google           Postgres
   │  GET /                  │                            │                │
   │───────────────────────►│  middleware: no session    │                │
   │  302 → /sign-in        ◄│                            │                │
   │  click "Continue…"      │                            │                │
   │───────────────────────►│  authClient.signIn.social  │                │
   │                         │  302 → Google consent ────►│                │
   │  approve  ◄─────────────────────────────────────────│                │
   │  GET /api/auth/callback/google ───────────────────►  │                │
   │                         │  Better Auth verifies code │                │
   │                         │  upsert user/account/session ──────────────►│
   │  Set-Cookie: session    │                            │                │
   │  302 → / (callbackURL) ◄│                            │                │
```

After this the session cookie is present, `middleware.ts` lets requests through,
and `app-sidebar.tsx` renders the avatar + sign-out button (`authClient.signOut`).

## Authenticated API call flow

```
Browser ──/api/proxy/tools/...──► Next.js proxy ──X-Internal-Key──► FastAPI
                                   getSession()                     require_internal_key()
                                   (401 if none)                    (401 if key mismatch)
```

`apps/web/src/lib/api.ts` points every backend call at `/api/proxy`, never at
FastAPI directly. The proxy (`src/app/api/proxy/[...path]/route.ts`) does three
things: (1) `auth.api.getSession()` → 401 if logged out, (2) sets
`x-internal-key` and `x-user-id`, (3) streams the request through to
`INTERNAL_API_URL`.

## Environment variables

Set in `apps/web/.env.local` (the web app owns auth):

| Var | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Signs/encrypts session data. Any long random string. |
| `BETTER_AUTH_URL` | Base URL Better Auth runs at, e.g. `http://localhost:3000`. |
| `NEXT_PUBLIC_APP_URL` | Same base URL, exposed to the browser for the auth client. |
| `DATABASE_URL` | Postgres connection string (holds the Better Auth tables). |
| `GOOGLE_CLIENT_ID` | OAuth client ID — `<projectnum>-<hash>.apps.googleusercontent.com`. |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (`GOCSPX-…`). |
| `INTERNAL_API_KEY` | Shared secret with FastAPI. **Must match `apps/api/.env`.** |
| `INTERNAL_API_URL` | Where FastAPI lives, e.g. `http://localhost:8000`. |

Set in `apps/api/.env` (the backend side):

| Var | Purpose |
|---|---|
| `INTERNAL_API_KEY` | Same value as the web app's. Mismatch → every API call 401s. |

`.env.local` and `.env` hold live secrets — keep them gitignored, never commit.

## Database

Better Auth uses its own Postgres tables: `user`, `session`, `account`,
`verification`. They live in the same database as the app's `jobs` table. Create
them once with the Better Auth CLI:

```
cd apps/web && npx @better-auth/cli migrate
```

## Google Cloud Console setup

In the OAuth client's **Authorized redirect URIs**, register the callback exactly:

```
http://localhost:3000/api/auth/callback/google      # dev
https://<your-domain>/api/auth/callback/google       # prod
```

A missing/mismatched entry yields `redirect_uri_mismatch`.

## Gotchas (things that have actually bitten us)

- **`GOOGLE_CLIENT_ID` must have no stray characters.** A leading `-` (or trailing
  whitespace) makes Google return `invalid_client` and login silently fails.
- **The route guard file must be `src/middleware.ts` exporting `middleware`.**
  Next.js ignores any other filename/export (e.g. a `proxy.ts` exporting `proxy`),
  so logged-out users won't be redirected and the login/logout UI never appears.
- **`INTERNAL_API_KEY` must be byte-identical on both sides.** The value is
  arbitrary; the only requirement is that web and api agree.
- **Restart the dev server after editing env files** — they're read only at boot.
- **No session → no sign-out button.** The sidebar footer renders only when
  `authClient.useSession()` returns a session, so a broken login looks like a
  "missing logout feature."
