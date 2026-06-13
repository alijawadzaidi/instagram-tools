# Audit: Current Frontend (`apps/web`)

> Source of truth for the restructure research. Every claim below is backed by a file path in the repo as of commit `00eb4f8` (main, clean tree). All 46 files under `apps/web/src` were read; total ~4,400 lines, of which ~1,900 are shadcn `components/ui/*` boilerplate.

---

## 1. Current structure

```
apps/web/src
├── middleware.ts                          # better-auth session-cookie gate (15 LOC)
├── app/
│   ├── layout.tsx                         # fonts, ThemeProvider, Toaster
│   ├── globals.css
│   ├── favicon.ico
│   ├── (auth)/
│   │   ├── layout.tsx                     # centered shell
│   │   └── sign-in/page.tsx               # Google sign-in (53 LOC, inline GoogleIcon svg)
│   ├── (dashboard)/
│   │   ├── layout.tsx                     # SidebarProvider + header
│   │   ├── page.tsx                       # home grid, renders from lib/tools.ts (server comp)
│   │   └── tools/
│   │       ├── transcribe/page.tsx        # 184 LOC  "use client"
│   │       ├── profile/page.tsx           # 363 LOC  "use client"
│   │       ├── hashtags/page.tsx          # 236 LOC  "use client"
│   │       ├── ranking/page.tsx           # 189 LOC  "use client"
│   │       ├── overview/page.tsx          # 159 LOC  "use client"
│   │       ├── export/page.tsx            # 142 LOC  "use client"
│   │       └── cover/page.tsx             # 113 LOC  "use client"
│   └── api/
│       ├── auth/[...all]/route.ts         # better-auth handler (4 LOC)
│       └── proxy/[...path]/route.ts       # BFF proxy → FastAPI (52 LOC)
├── components/
│   ├── app-sidebar.tsx                    # renders from lib/tools.ts + session footer
│   ├── download-control.tsx               # quality select + download (own fetch in useEffect)
│   ├── hashtag-chips.tsx                  # copyable chips
│   ├── mode-toggle.tsx
│   ├── theme-provider.tsx
│   └── ui/                                # 16 shadcn primitives (sidebar, card, button, …)
├── hooks/
│   └── use-mobile.ts                      # only hook in the app (shadcn-supplied)
└── lib/
    ├── api.ts                             # 233 LOC: ALL types + ALL fetchers + polling helper
    ├── auth.ts                            # better-auth server config (pg Pool)
    ├── auth-client.ts                     # better-auth react client
    ├── export.ts                          # CSV/Markdown serializers + downloadText()
    ├── hashtags.ts                        # client-side hashtag analytics
    ├── tools.ts                           # ★ tool registry (slug/name/desc/icon/status)
    └── utils.ts                           # cn()
```

Monorepo context: `pnpm-workspace.yaml` already declares `packages/*`, but **no `packages/` directory exists** — zero shared packages today. `apps/web/package.json` has no data-fetching library (no react-query, no swr, no zod, no zustand): the entire client data layer is hand-rolled `fetch` + `useState`.

---

## 2. Structural problems for scale

### 2.1 Every tool page is a fat client component (fetch + state + UI in one file)

All 7 tool pages start with `"use client"` and own their fetching, busy-flags, error handling, and rendering in a single default export. Example state blocks:

- `tools/profile/page.tsx` — **10 `useState` hooks** in one component (`username`, `activeUser`, `loading`, `loadingMore`, `cursor`, `reels`, `selected`, `states`, `transcribing`, `dlQuality`, `downloading`) plus a hand-rolled concurrency-limited worker pool for batch transcription (lines ~115–150).
- `tools/transcribe/page.tsx` — 5 `useState` + a hand-rolled debounce `useEffect` for the download-URL.

There are no Server Components doing data work, no Suspense, no loading.tsx/error.tsx anywhere — every page is "blank until the user submits", and every async edge is handled ad hoc with `toast.error`.

### 2.2 Duplication across the 7 tool pages — quantified

The same logic is copy-pasted, with file:line evidence:

| Repeated logic | Copies | Where |
|---|---|---|
| **Username search flow** (`username`/`activeUser`/`reels`/`cursor`/`loading`/`loadingMore` state + `handleFind` + `loadMore` + shortcode de-dupe) | **4** (~60 LOC each ≈ 240 LOC) | `profile`, `hashtags`, `ranking`, `export` pages — `handleFind`/`loadMore` bodies are near-identical character-for-character |
| Shortcode de-dupe inside `loadMore` (`const seen = new Set(prev.map(r => r.shortcode))…`) | 4 | same 4 pages |
| `INSTAGRAM_URL` regex constant | 2 | `transcribe/page.tsx:26`, `cover/page.tsx` (line ~744 in concat; top of file) — drift risk if URL formats change |
| `compact()` / `formatViews()` number formatter (1.2M / 3.4K) | **3** | `profile/page.tsx` (`formatViews`), `ranking/page.tsx` (`compact`), `overview/page.tsx` (`compact`) |
| Local `Stat` card component | **3** | `hashtags/page.tsx:20`, `ranking/page.tsx`, `overview/page.tsx` (two are identical, one adds `text-center`) |
| Page header block (icon-in-muted-square + h1 + subtitle, ~12 LOC) | **7** | every tool page — even though name/description/icon already live in `lib/tools.ts`; pages re-hardcode all three, so registry and page copy can drift |
| `@`-prefixed username input markup (absolute-positioned span + `pl-7` input) | 4 | `profile`, `hashtags`, `ranking`, `export` |
| `toast.error(err instanceof Error ? err.message : "…")` catch pattern | ~10 | every async handler in every page |
| Programmatic `<a>` click download (`createElement("a")`, `appendChild`, `click()`, `remove()`) | **5** | `lib/api.ts:downloadZip`, `lib/export.ts:downloadText`, `overview/page.tsx:downloadPic`, `cover/page.tsx:download`, `components/download-control.tsx:handleDownload` |
| Submit-button loading state (`{loading ? <Loader2 spin/> : <Icon/>}`) | 7 | every page form |

Net effect: adding tool #8 that consumes profile reels means **copy-pasting ~100 lines** of state machine + form markup and hoping you don't fork-drift the de-dupe or error handling. At 30 tools that's ~20 forks of the same search flow.

### 2.3 No query/cache layer

- `lib/api.ts` is raw `fetch` wrappers; there is **no caching, no deduping, no retry, no invalidation**. `package.json` confirms: no `@tanstack/react-query`, no `swr`.
- Concrete user-facing cost today: `profile`, `hashtags`, `ranking`, and `export` all call the same `POST /tools/profile/reels`. Researching one account across those 4 tools means **re-typing the username 4 times and re-fetching the same pages 4 times** (each one a live Instagram scrape on the backend — slow and rate-limit-prone). Navigating away and back loses everything.
- Job polling (`transcribeReel` in `lib/api.ts:191–233`) is a bespoke while-loop with `setTimeout`; component unmount mid-poll leaks the loop unless callers wire `AbortSignal` — and **no caller passes one** (`transcribe/page.tsx`, `profile/page.tsx` both omit it).
- `download-control.tsx` does its own `useEffect` fetch with a hand-rolled `cancelled` flag — a third fetching idiom in the same app.

### 2.4 Flat `lib/`, no feature modules

`lib/api.ts` (233 LOC) is the API surface for **all** tools: transcribe types + fetchers, profile reels, profile info, covers, formats, zip download, image download, and a polling orchestrator, in one file. `lib/export.ts` and `lib/hashtags.ts` are tool-specific business logic for the `export` and `hashtags` tools but live as global siblings of `auth.ts` and `utils.ts`. At 30 tools this becomes either one 1,000+ line `api.ts` or an unprincipled scatter. There is no `features/` or `modules/` concept; the only per-tool boundary is the route folder, which holds exactly one file (the fat page).

### 2.5 Types: hand-maintained, snake_case, not shared with backend

- All API types (`ReelSummary`, `ProfileInfo`, `Job`, …) are **hand-written in `lib/api.ts`** and must be kept in sync by eye with the Pydantic schemas in `apps/api/tools/*/schemas.py`. No codegen (FastAPI already emits OpenAPI for free), no zod validation at the boundary — a backend rename fails silently at runtime.
- Backend snake_case (`view_count`, `taken_at`, `next_cursor`, `cover_url`) leaks all the way into JSX.
- UI-local types are redeclared per page (`ReelState` in `profile/page.tsx`; `cover/page.tsx` re-shapes `CoverResponse` into an inline `{ shortcode; coverUrl }`).

### 2.6 Error & loading handling is all-toast, all-manual

- Errors are stringly typed: `lib/api.ts:http()` throws `new Error(detail)`, discarding HTTP status and the backend's machine-readable `error_code` (which the `Job` type explicitly carries — `error_code?: "private" | "rate_limited" | …` per the comment — but nothing ever reads it). No way to render "this account is private" differently from "rate limited, retry in a minute".
- No `error.tsx`, no `loading.tsx`, no error boundaries, no empty-state components — each page improvises (`toast.info("No reels found…")` in profile vs. silent empty in hashtags).
- No retry anywhere; one flaky Instagram response = user manually resubmits.

### 2.7 The BFF proxy and auth are fine but have sharp edges

`app/api/proxy/[...path]/route.ts` is a good pattern (session check → forward with `x-internal-key` + `x-user-id`), but:

- Only `GET`/`POST` are exported — a future `DELETE /jobs/:id` or `PATCH` silently 405s.
- It runs `auth.api.getSession()` (a Postgres round-trip via the `pg` Pool in `lib/auth.ts`) on **every** proxied call — including every 2-second poll tick of every running transcription job. At 30 tools with AI/LLM streaming endpoints this becomes a real DB load and latency tax; no session caching.
- Streaming responses pass through (good — body is piped), but there's no timeout/abort handling for hung upstreams.
- `middleware.ts` matcher excludes all of `/api`, so the proxy's own session check is the only guard — correct, but worth noting the proxy is load-bearing for security.
- Client-side, `API_URL = "/api/proxy"` is hardcoded in `lib/api.ts` — fine, but the two download-URL builders (`imageDownloadUrl`, `downloadFileUrl`) bake it in too, so moving the proxy means a grep hunt.

### 2.8 Misc smells

- Raw `<img>` + eslint-disable in 4 files instead of one `<InstagramImage>` wrapper (referrerPolicy + fallback handled once).
- Native `<select>` styled by hand in 2 places (`profile/page.tsx` quality picker, `download-control.tsx`) instead of a shadcn Select — and the two quality lists are independently hardcoded.
- `hooks/` contains a single shadcn hook; none of the app's real reusable behaviors (debounce, clipboard-copy-with-checkmark — duplicated in `transcribe/page.tsx:handleCopy` and `hashtag-chips.tsx:copyAll`) are hooks.
- No tests, no storybook, nothing enforcing the structure.

---

## 3. What is GOOD and must be preserved

1. **The tool registry (`lib/tools.ts`)** — the single best idea in the codebase. One typed array drives the sidebar (`app-sidebar.tsx`), the home grid (`(dashboard)/page.tsx`), and routing convention (`toolHref`). The doc comment even spells out the 2-step "add a tool" recipe. The restructure should *extend* this (point each registry entry at a feature module, derive page headers/metadata from it), never replace it.
2. **The BFF proxy pattern** (`app/api/proxy/[...path]/route.ts`) — auth at the edge, internal key + user id forwarded, hop-by-hop headers stripped, streaming bodies piped. Right architecture for the FastAPI split; keep it, harden it (more methods, session caching).
3. **Async-job-with-polling design** for long transcriptions (`startTranscription` → `getJob`) — correct for LLM/AI tools too; it just needs to live in a query layer instead of a bespoke loop.
4. **`lib/api.ts` is already a typed client with good docs** — wrong granularity (one file), but the discipline (every endpoint typed, JSDoc'd, error-body parsing centralized in `http<T>`) is exactly what the future per-feature API modules should inherit.
5. **Quality of the small shared components** — `HashtagChips` and `DownloadControl` are properly extracted, prop-typed, self-contained. The instinct exists; it just hasn't been applied to the big repeated flows.
6. **Pure, testable domain logic already separated** — `lib/hashtags.ts` (analytics) and `lib/export.ts` (serializers) are side-effect-free functions over `ReelSummary[]`. They're just in the wrong folder, not the wrong shape.
7. **Route groups + middleware auth** — `(auth)` / `(dashboard)` split, cookie check in `middleware.ts`, server-rendered home page. Sound App Router usage.
8. **Backend mirrors the tool concept** (`apps/api/tools/{transcribe,profile,download}/` + `shared/`) — frontend feature modules can map 1:1 onto it.

---

## 4. Problems ranked by pain at 30 tools

| # | Problem | Pain at 30 tools | Why |
|---|---|---|---|
| 1 | **No query/cache layer** (§2.3) | Severe | Every tool refetches scrapes; cross-tool username re-entry ×30; polling loops leak; AI tools (streaming, retries, cost-per-call) are unbuildable on raw fetch+useState. This is the single biggest blocker. |
| 2 | **Copy-paste tool pages / no feature modules** (§2.1, §2.2, §2.4) | Severe | "Add a tool" currently = fork 100–360 LOC. ×30 ≈ thousands of lines of drift-prone clones; one bug fix (e.g. de-dupe) needs 20+ edits. Kills the cheap-tool roadmap. |
| 3 | **One flat `lib/api.ts`** (§2.4) | High | 233 LOC at 8 tools → ~900+ LOC merge-conflict magnet at 30. Must shard per feature (and ideally generate from FastAPI's OpenAPI). |
| 4 | **Hand-synced types, no boundary validation** (§2.5) | High | 30 tools × N schemas maintained by eye across two languages = guaranteed silent runtime breaks. |
| 5 | **Stringly-typed errors, `error_code` dropped** (§2.6) | High | AI tools need rich error UX (quota, content-filter, rate-limit, retry-after). The current `throw new Error(detail)` + toast can't express it. |
| 6 | **Per-request DB session lookup in proxy, GET/POST only** (§2.7) | Medium | Latency + DB load scale with tool count and polling; missing methods will bite the first non-CRUD tool. Cheap to fix now. |
| 7 | **Duplicated UI atoms** (Stat, page header, compact(), @-input, download anchor) (§2.2) | Medium | Annoying ×30 but mechanical; falls out for free once feature modules + a `ToolPageShell` driven by the registry exist. |
| 8 | **No `packages/` despite workspace config** | Medium | Shared types/UI/config have nowhere to live; matters the moment a second consumer (marketing site, CLI, desktop) or generated API client appears. |
| 9 | **No error/loading boundaries, no empty states** (§2.6) | Low-Medium | UX papercuts that compound; solvable with a few shared components once the shell exists. |
| 10 | **Misc smells** (raw `<img>`, native selects, missing hooks) (§2.8) | Low | Cleanup work, not architecture. |

---

## What instagram-tools should take from this

1. **Keep and promote the tool registry to the organizing spine.** Each `tools.ts` entry should reference its feature module; derive every page's header (icon/name/description), `metadata`, and sidebar entry from the registry so they can never drift (today all 7 pages hardcode what the registry already knows).
2. **Introduce feature modules now**: `src/features/<tool>/{components,hooks,api.ts,types.ts,lib}` mirroring `apps/api/tools/<name>/`. Move `lib/hashtags.ts` → `features/hashtags/lib`, `lib/export.ts` → `features/export/lib`, and shard `lib/api.ts` into per-feature `api.ts` files over a tiny shared `http<T>` client. Route files become thin: `tools/<slug>/page.tsx` just renders `features/<slug>/<Tool>Page`.
3. **Adopt TanStack Query as the data layer** — `useProfileReels(username)` as an `useInfiniteQuery` (cursor pagination + de-dupe in one place) instantly fixes the 4-page duplication AND gives cross-tool caching (type a username once, all reel-based tools share the cache). Job polling becomes `useQuery` with `refetchInterval`, killing the leak-prone bespoke loop.
4. **Extract the two repeated flows into shared hooks/components**: `useProfileSearch` / `<UsernameSearchForm>` (4 copies today) and `<ReelUrlForm>` with one exported `INSTAGRAM_URL` regex (2 copies). Plus one-time atoms: `<StatCard>` (3 copies), `<ToolPageShell>` (7 copies), `formatCompact()` (3 copies), `triggerBrowserDownload()` (5 copies of the anchor-click trick).
5. **Stand up `packages/`** (workspace already allows it): at minimum `packages/api-client` generated from FastAPI's OpenAPI spec (orval/openapi-ts) so frontend types can't drift from Pydantic schemas — this also fixes snake_case-by-convention and removes hand-written interfaces from `lib/api.ts`.
6. **Make errors structured end-to-end**: a typed `ApiError { status, code, message }` thrown by the shared client, surfacing the backend's existing-but-ignored `error_code`; map codes to UX (retry button for `rate_limited`, explainer for `private`). Required before AI tools, whose failure modes are richer.
7. **Harden the proxy before scaling**: export all HTTP methods, cache session validation (e.g. better-auth cookie-cache or short in-memory TTL) so 2-second job polls and future streaming AI endpoints don't hammer Postgres, and add an upstream timeout.
8. **Define the "add a tool" recipe as ≤4 files**: registry entry + `features/<slug>/` module + thin `page.tsx` + backend `tools/<slug>/` — and consider a scaffold script (`pnpm new-tool <slug>`) so the recipe is enforced, not remembered.
9. **Preserve what works**: BFF proxy architecture, async-job polling design, the pure-function domain libs (`hashtags`, `export` — just relocate them), and the extraction quality of `HashtagChips`/`DownloadControl` as the bar for new shared components.
