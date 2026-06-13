# Proposed Structure (DRAFT) — instagram-tools Restructure

> Synthesis of research docs 01–05 in this folder. Status: **draft for review** — see §7 open questions.
> Goal: make "adding a tool" cheap and uniform from tool #8 through tool #30, including AI/LLM tools,
> without cargo-culting binsr/cal.com scale. One web app, one FastAPI backend, pnpm + Turborepo.

Ground truth as of today (verified against the repo):

- 7 shipped tools in `apps/web/src/lib/tools.ts` (`transcribe`, `profile`, `hashtags`, `overview`, `cover`, `ranking`, `export`); 7 fat client pages under `apps/web/src/app/(dashboard)/tools/*`.
- 3 backend modules in `apps/api/app/tools/` (`transcribe`, `profile`, `download`) + an 840-LOC `shared/` grab bag.
- One flat 233-line `apps/web/src/lib/api.ts`; no query library; no `packages/` directory despite `pnpm-workspace.yaml` allowing it.

---

## 0. The design in one paragraph

Every tool becomes a **feature module** at `apps/web/src/features/<slug>/` that mirrors a backend module at `apps/api/app/tools/<slug>/`. Types and the HTTP client are **generated** from FastAPI's OpenAPI spec into `packages/api-client` (hey-api + TanStack Query plugin), so Pydantic `schemas.py` is the single source of truth. **TanStack Query** is the data layer: per-feature `queryOptions` factories, shared cross-tool query factories for the profile-reels scrape, `refetchInterval` for job polling. The **tool registry stays the spine** but is derived from each feature's `meta.ts` instead of being a parallel source of truth. Route files become ~12-line shells. The backend splits `shared/` into `core/` + `integrations/instagram/` + `providers/` (the transcribe-engines pattern promoted for LLMs), gets a global `ToolError` handler, plain-`def`/httpx-async handlers, and a Postgres `SKIP LOCKED` job queue with a reaper — the prerequisites for AI tools. ESLint `import/no-restricted-paths` enforces `shared → features → app` from day one, and `pnpm new-tool` scaffolds the whole recipe.

---

## 1. Target tree — `apps/web`

```
apps/web/src/
├── middleware.ts                          # better-auth cookie gate (unchanged)
│
├── app/                                   # ROUTING SHELL ONLY — no business logic, no fetch
│   ├── layout.tsx                         # fonts, ThemeProvider, QueryProvider, Toaster
│   ├── globals.css
│   ├── (auth)/
│   │   ├── layout.tsx                     # centered auth shell
│   │   └── sign-in/page.tsx               # Google sign-in
│   ├── (dashboard)/
│   │   ├── layout.tsx                     # SidebarProvider + header
│   │   ├── page.tsx                       # home grid — renders from features/registry (server comp)
│   │   └── tools/
│   │       ├── transcribe/page.tsx        # ~12 LOC: metadata from meta.ts + <TranscribeView/>
│   │       ├── profile/page.tsx           # same shape, one per tool
│   │       ├── hashtags/page.tsx
│   │       ├── overview/page.tsx
│   │       ├── cover/page.tsx
│   │       ├── ranking/page.tsx
│   │       └── export/page.tsx
│   └── api/
│       ├── auth/[...all]/route.ts         # better-auth handler (unchanged)
│       └── proxy/[...path]/route.ts       # BFF proxy — HARDENED: all HTTP methods, cached
│                                          #   session validation (TTL), upstream timeout/abort
│
├── features/                              # ONE FOLDER PER TOOL — mirrors apps/api/app/tools/<slug>
│   ├── registry.ts                        # imports each feature's meta.ts; the single registry
│   │                                      #   driving sidebar, home grid, page headers, toolHref()
│   │                                      #   (replaces lib/tools.ts; one import line per tool)
│   │
│   ├── transcribe/                        # ── reference feature (job-based tool) ──
│   │   ├── meta.ts                        # { slug, name, description, icon, status } — registry entry
│   │   ├── components/
│   │   │   └── transcribe-view.tsx        # the screen (former page.tsx body), "use client"
│   │   ├── queries.ts                     # queryOptions factory: wraps generated client opts,
│   │   │                                  #   adds staleTime/select; job poll = refetchInterval
│   │   ├── types.ts                       # UI-only types (API types come from @repo/api-client)
│   │   └── index.ts                       # public surface: export { meta }, export { TranscribeView }
│   │
│   ├── profile/                           # ── reference feature (search/paginate tool) ──
│   │   ├── meta.ts
│   │   ├── components/
│   │   │   ├── profile-view.tsx
│   │   │   └── reel-card.tsx              # feature-scoped components stay here
│   │   ├── hooks/
│   │   │   └── use-batch-transcribe.ts    # hooks ONLY when they add real logic
│   │   │                                  #   (concurrency-limited batch transcription pool)
│   │   ├── queries.ts
│   │   └── index.ts
│   │
│   ├── hashtags/
│   │   ├── meta.ts
│   │   ├── components/hashtags-view.tsx
│   │   ├── lib/
│   │   │   └── analyze.ts                 # moved from src/lib/hashtags.ts (pure, testable)
│   │   └── index.ts                       # no queries.ts — consumes shared profile-reels query
│   │
│   ├── export/
│   │   ├── meta.ts
│   │   ├── components/export-view.tsx
│   │   ├── lib/
│   │   │   └── serializers.ts             # moved from src/lib/export.ts (CSV/Markdown)
│   │   └── index.ts
│   │
│   ├── overview/  …                       # meta.ts + components/ + index.ts (folders are optional —
│   ├── cover/     …                       #   bulletproof-react rule: small feature = small folder)
│   └── ranking/   …
│
├── queries/                               # SHARED query factories — resources used by 2+ tools
│   │                                      #   (features must not import each other, so cross-tool
│   │                                      #    data lives in the shared layer, per ESLint zones)
│   ├── profile-reels.ts                   # infiniteQueryOptions over generated client: cursor
│   │                                      #   pagination + shortcode de-dupe (via select) ONCE —
│   │                                      #   replaces the 4 copy-pasted handleFind/loadMore flows;
│   │                                      #   profile/hashtags/ranking/export share this cache
│   ├── profile-info.ts                    # used by overview + profile
│   └── jobs.ts                            # generic job-polling queryOptions (refetchInterval until
│                                          #   terminal status) — replaces the leak-prone while-loop;
│                                          #   reused by transcribe and every future AI job tool
│
├── components/                            # SHARED components — import ui/ + queries/, never features
│   ├── ui/                                # shadcn primitives (unchanged; imports nothing domain)
│   ├── tool-page-shell.tsx                # icon + h1 + subtitle derived from a meta.ts entry
│   │                                      #   (kills 7 hand-coded header blocks)
│   ├── username-search-form.tsx           # @-prefixed input + submit + loading (kills 4 copies)
│   ├── reel-url-form.tsx                  # URL input w/ single INSTAGRAM_URL regex (kills 2 copies)
│   ├── reel-grid.tsx                      # shared reel-card grid w/ load-more (used by 4 tools)
│   ├── stat-card.tsx                      # (kills 3 copies)
│   ├── instagram-image.tsx                # <img> wrapper: referrerPolicy + fallback (kills 4 copies)
│   ├── download-control.tsx               # existing — rewired onto shared queries
│   ├── hashtag-chips.tsx                  # existing — kept as-is (extraction quality bar)
│   ├── app-sidebar.tsx                    # renders from features/registry
│   ├── mode-toggle.tsx
│   └── theme-provider.tsx
│
├── hooks/                                 # SHARED hooks (non-data)
│   ├── use-copy-to-clipboard.ts           # copy-with-checkmark (kills 2 copies)
│   └── use-mobile.ts                      # shadcn (existing)
│
├── providers/                             # app-root composition glue ONLY (binsr rule: 1-2 files)
│   └── query-provider.tsx                 # QueryClientProvider + defaults (retry policy keyed off
│                                          #   ApiError.retryable; structured error toasts)
│
└── lib/                                   # TINY shared utils only — "every lib file earns its place"
    ├── auth.ts                            # better-auth server config (unchanged)
    ├── auth-client.ts                     # (unchanged)
    ├── format.ts                          # formatCompact() 1.2M/3.4K (kills 3 copies)
    ├── download.ts                        # triggerBrowserDownload() anchor trick (kills 5 copies)
    └── utils.ts                           # cn()
```

**Deleted after migration:** `lib/api.ts` (→ generated client + queries/), `lib/tools.ts` (→ `features/registry.ts` + per-feature `meta.ts`), `lib/hashtags.ts` (→ `features/hashtags/lib/`), `lib/export.ts` (→ `features/export/lib/`).

### Import directionality (enforced by ESLint `import/no-restricted-paths`)

```
components/ui  →  imports nothing domain-specific
lib, hooks, queries, components  →  may import ui + @repo/api-client, never features/ or app/
features/<a>   →  imports shared layers + @repo/api-client; NEVER features/<b>, NEVER app/
app/           →  imports features (the only consumer of feature index.ts)
```

Verbatim zone config is in `05-industry-patterns.md` §1.3 — add it in the same PR that creates `features/`.

### Error contract

`@repo/api-client`'s fetch layer throws a typed `ApiError { status, code, message, retryable }`, populated from the backend's global `{code, message}` handler (§2). The QueryProvider maps codes to UX once: `rate_limited` → retry button/backoff, `private` → explainer, `engine_error` → report link. No more `toast.error(err instanceof Error ? …)` ×10.

---

## 2. Target tree — `apps/api`

Refinements only where the audit found real problems: blocking I/O, the jobs model, the `shared/` grab bag, error duplication, config fragility, and AI-tool readiness.

```
apps/api/
├── pyproject.toml                  # NEW: pinned deps + lockfile, ruff, pytest config
│                                   #   (replaces unpinned requirements.txt)
├── openapi.json                    # NEW: committed contract artifact, exported by a command;
│                                   #   input for packages/api-client codegen; CI fails on drift
├── alembic/                        # migrations (existing) + new: jobs columns, indexes, results table
├── tests/                          # NEW
│   ├── fixtures/instagram/         # recorded IG responses — contract tests for the most fragile,
│   │                               #   most valuable code (extractor/profile parsing)
│   └── tools/                      # per-tool service tests (services are plain callables)
└── app/
    ├── main.py                     # app factory; ONE global ToolError handler → {code, message}
    │                               #   (deletes 6 duplicated try/except blocks); auto-discovers
    │                               #   tools/*/router.py (adding a tool touches no shared files);
    │                               #   generate_unique_id_function=f"{tags[0]}-{name}" for clean
    │                               #   SDK names; startup: settings validation + job reaper
    │
    ├── core/                       # infrastructure — importable by everything
    │   ├── config.py               # nested pydantic-settings groups: settings.db / settings.ig /
    │   │                           #   settings.llm / settings.transcribe; fail-fast (no "" defaults)
    │   ├── errors.py               # ToolError taxonomy (existing, kept — it's good)
    │   ├── auth.py                 # require_internal_key BFF dependency (existing, kept)
    │   ├── logging.py              # NEW: structured logging + request IDs (today: zero logging)
    │   ├── db.py                   # engine created in factory, NOT at import time; pool_pre_ping
    │   └── cache.py                # NEW: TTL cache interface — in-memory now, Redis later;
    │                               #   keys: cookie warmup, username→user_id, (tool, shortcode,
    │                               #   params_hash) for transcripts/LLM results
    │
    ├── jobs/                       # the async-work platform (promoted out of shared/jobs.py)
    │   ├── models.py               # Job ORM + NEW columns while the table is tiny: user_id,
    │   │                           #   params JSONB, tokens_in/out, cost_cents; indexes on
    │   │                           #   (tool, status, created_at); result JSON → JSONB
    │   ├── queue.py                # enqueue + claim via SELECT … FOR UPDATE SKIP LOCKED
    │   ├── worker.py               # worker loop — runs in-process today, separable to its own
    │   │                           #   process/replica without code changes; per-tool concurrency
    │   └── reaper.py               # startup reaper: stale "running" rows → error: interrupted
    │
    ├── integrations/
    │   └── instagram/              # the IG client as a platform package (from shared/ig_*)
    │       ├── http.py             # httpx.AsyncClient — replaces hand-rolled urllib ig_http
    │       ├── session.py          # cookie warmup, CACHED (today: 2 IG hits per request)
    │       ├── extractor.py        # single-reel extraction (loud failures, no silent except)
    │       ├── profile.py          # profile info + cursor pagination
    │       └── download.py         # yt-dlp quality ladder
    │
    ├── providers/                  # the transcribe-engines pattern, PROMOTED (Protocol +
    │   │                           #   string-path registry + lazy cached singletons)
    │   ├── transcription/          # moved from tools/transcribe/engines/ — base.py, registry,
    │   │   └── …                   #   local_whisper / openai / assemblyai
    │   └── llm/                    # NEW, same shape: base.py (Protocol: complete/stream),
    │       └── …                   #   anthropic.py / openai.py; retries, timeouts, and per-call
    │                               #   structured logs of model/tokens/latency built in ONCE
    │
    ├── media/                      # media utilities (from shared/audio.py, downloader.py)
    │   ├── audio.py                # ffmpeg → wav
    │   └── downloader.py           # direct-CDN + yt-dlp fallback
    │
    └── tools/                      # vertical slices — the ONLY place product logic lives
        │                           # CONTRACT: router.py (thin transport, tags=["<slug>"],
        │                           #   plain `def` or truly-async handlers — never blocking work
        │                           #   inside `async def`) + schemas.py (the type source of truth)
        │                           #   + service.py (MANDATORY; plain callable, composable into
        │                           #   job chains). Routers import only their own service + core.
        │                           #   Tools NEVER import other tools.
        ├── transcribe/
        │   ├── router.py
        │   ├── schemas.py
        │   └── service.py          # engines/ moved out to providers/transcription
        ├── profile/
        │   ├── router.py           # /reels, /info
        │   ├── schemas.py
        │   └── service.py          # NEW — logic moved here from shared/ig_profile.py
        ├── download/
        │   ├── router.py           # /formats, /file ONLY (cover/image/zip split out)
        │   ├── schemas.py
        │   └── service.py          # logic from shared/ig_download.py
        ├── cover/                  # NEW module — /cover + /image proxy out of download/router.py
        │   ├── router.py
        │   ├── schemas.py
        │   └── service.py
        ├── export/                 # NEW module — /zip becomes a JOB, not a synchronous
        │   ├── router.py           #   up-to-50-download request (the worst event-loop blocker)
        │   ├── schemas.py
        │   └── service.py
        └── <ai-tool>/              # FUTURE convention, decided now:
            ├── router.py           #   POST → job (poll) and/or GET /stream → SSE
            ├── schemas.py
            ├── service.py          #   calls providers/llm, integrations/instagram, core/cache
            └── prompts.py          #   prompts live here, versioned with the tool
```

Backend↔frontend mapping rule: **a backend module exists per backend capability; a frontend tool that is a pure composition over an existing endpoint needs no backend module.** `hashtags`, `ranking`, `overview` consume `profile`'s endpoints and that's correct — their `meta.ts` simply has no dedicated backend slug. (5 backend modules today after the split, not a forced 8.)

---

## 3. `packages/` — create now vs defer

The workspace config already allows `packages/*`; nothing exists yet. Right-sizing for one web app and 8→30 tools:

### Create NOW (exactly one package)

```
packages/
└── api-client/                     # @repo/api-client — GENERATED, do-not-edit
    ├── package.json                # consumed as workspace:* by apps/web
    ├── openapi-ts.config.ts        # input: ../../apps/api/openapi.json
    └── src/                        # hey-api output: types.gen.ts, sdk.gen.ts,
                                    #   @tanstack/react-query.gen.ts (queryOptions /
                                    #   infiniteQueryOptions / mutationOptions / queryKeys)
```

Why this one: it kills the four worst frontend problems at once (hand-synced types, the flat `api.ts`, snake_case drift, dropped `error_code`), and "generated code physically separate from app source" is the one packaging boundary that pays for itself immediately (05 §5.3). Sync automation: `pnpm gen` one-shot, watchers in dev, CI/pre-commit "regenerate and `git diff --exit-code`".

### Defer (with explicit triggers)

| Package | Why defer | Create when |
|---|---|---|
| `packages/types` | The generated client **is** the shared types package; UI-only types stay in features. binsr needed `@repo/types` because 3 apps share hand-written models — we have 1 app and generated models. | A second consumer (mobile, CLI, worker) needs non-API types. |
| `packages/features` | cal.com extracts features because multiple apps consume them. With one web app, `apps/web/src/features/` is correct (04, explicit). | Second app consumes feature logic. |
| `packages/ui` | shadcn `components/ui` inside the app is fine; the lesson is the directionality rule, not the package split. | Second app needs the design system. |
| `packages/config` (tsconfig/eslint) | One app + one package; root configs suffice. | 3+ TS workspace members. |
| Registry codegen (cal.com `app-store-cli`) | Hand-maintained `features/registry.ts` (one import line per tool) is fine to ~25 tools. | ~25+ tools, or the import line gets forgotten twice. |

Anti-patterns explicitly avoided (binsr scars): no empty placeholder packages, no mega-barrel `index.ts` (api-client gets subpath exports if it ever grows), no scratch dirs in tree, no `-v2` parallel components — finish migrations and delete v1.

---

## 4. "Adding tool #9" walkthrough — the acceptance test

Scenario: **Caption Writer** (`caption`) — first AI tool: given a reel URL, transcribe it and have an LLM draft captions. Every file touched, in order:

**Backend (4 new files, 0 shared files edited):**

1. `apps/api/app/tools/caption/schemas.py` — `CaptionRequest`, `CaptionResult` Pydantic models. *This is the only place types are written, for both stacks.*
2. `apps/api/app/tools/caption/prompts.py` — prompt templates, versioned with the tool.
3. `apps/api/app/tools/caption/service.py` — plain callable: `integrations/instagram` fetch → `tools/transcribe/service` (via job chain) → `providers/llm` complete; `core/cache` keyed on `(tool, shortcode, params_hash)`.
4. `apps/api/app/tools/caption/router.py` — `tags=["caption"]`, `POST /tools/caption` enqueues a job. Auto-discovered by `main.py` — **no `main.py` edit**. Errors handled by the global handler — **no try/except**. Job runs on the queue with the reaper and cost columns — **no new plumbing**.

**Contract:**

5. `pnpm gen` — exports `openapi.json`, regenerates `packages/api-client`. `captionCreateMutation()` / job queryOptions now exist, fully typed. **No hand-written types anywhere.**

**Frontend (4 new files + 1 thin page + 1 import line):**

6. `apps/web/src/features/caption/meta.ts` — `{ slug: "caption", name: "Caption Writer", description, icon: PenLine, status: "live" }`.
7. `apps/web/src/features/caption/queries.ts` — wraps the generated mutation + the shared `queries/jobs.ts` polling factory; ~15 LOC.
8. `apps/web/src/features/caption/components/caption-view.tsx` — composes `<ToolPageShell meta={meta}>`, `<ReelUrlForm>`, result card. UI only — no fetch, no useState-for-data, no error mapping.
9. `apps/web/src/features/caption/index.ts` — `export { meta }; export { CaptionView }`.
10. `apps/web/src/features/registry.ts` — **one import line**. Sidebar + home grid update automatically.
11. `apps/web/src/app/(dashboard)/tools/caption/page.tsx` — ~12 LOC: `metadata` from `meta`, render `<CaptionView/>`.

`pnpm new-tool caption` scaffolds files 1–4 and 6–11 from templates; the human writes the service body, the prompt, and the view.

**Versus today:** fork a 360-LOC page (state machine + form + error handling), hand-write types into the 233-line `lib/api.ts`, hand-roll a polling loop (and leak it), edit `main.py`, duplicate the try/except block, hardcode the header the registry already knows — and an AI tool would additionally need an LLM client, cost tracking, and a durable queue that **do not exist**. The new recipe is ~10 small files, each with one job, none shared, all shaped identically to tools #1–8.

---

## 5. Migration plan — shippable phases, ordered by pain-relieved-per-effort

App must work after every phase. Each phase is one PR-sized unit (or two).

**Phase 0 — Hygiene + sharp edges (small, do first)**
Backend: global `ToolError` exception handler in `main.py` returning `{code, message}` (delete 6 try/except blocks); `pyproject.toml` with pinned deps + ruff + pytest; fail-fast settings validation; fixed `.env.example`; structured logging with request IDs; convert blocking `async def` handlers to plain `def` (one-word change per handler — FastAPI thread-pools them).
Frontend: proxy exports all HTTP methods, TTL-cached session validation, upstream timeout/abort.
*Relieves: event-loop stalls, invisible errors, dependency lottery. Touches no product code paths' shape.*

**Phase 1 — TanStack Query data layer (highest-leverage frontend change)**
Add `@tanstack/react-query` + `providers/query-provider.tsx`. Create `src/queries/{profile-reels,profile-info,jobs}.ts` over the *existing* `lib/api.ts` functions (codegen comes later — don't block on it). Convert the 4 username-search pages to the shared `infiniteQueryOptions` (cursor + de-dupe once, cross-tool cache) and transcribe/profile to `refetchInterval` polling. Introduce typed `ApiError` in the `http<T>` helper.
*Relieves: 4× duplicate scrapes, leak-prone polling loop, stringly errors. Pages still fat, but data layer is done.*

**Phase 2 — Feature modules + shared components**
Create `features/<tool>/` for all 7 tools: move page bodies to `components/<tool>-view.tsx`, add `meta.ts`, `index.ts`; thin out every `page.tsx`. Extract `ToolPageShell`, `UsernameSearchForm`, `ReelUrlForm`, `ReelGrid`, `StatCard`, `InstagramImage`, `formatCompact`, `triggerBrowserDownload`, `useCopyToClipboard`. Move `lib/hashtags.ts` → `features/hashtags/lib/`, `lib/export.ts` → `features/export/lib/`. Replace `lib/tools.ts` with `features/registry.ts`. Add the ESLint `import/no-restricted-paths` zones in this PR.
*Relieves: copy-paste tool pages (the #2 pain), registry/page drift. "Add a tool" recipe now exists.*

**Phase 3 — Generated typed client (`packages/api-client`)**
Backend: `tags=` on every router, `generate_unique_id_function`, `openapi.json` export command. Create `packages/api-client` with hey-api + TanStack Query plugin (`queryOptions`, `infiniteQueryOptions`, `queryKeys: true`). Rewire `src/queries/*` and feature `queries.ts` onto generated options; delete `lib/api.ts`. Add `pnpm gen`, dev watchers, CI drift check.
*Relieves: hand-synced types, schema drift, the 233-line file. Backend `schemas.py` is now the single source of truth.*

**Phase 4 — Backend restructure**
Split `shared/` → `core/` + `integrations/instagram/` + `media/`; promote `engines/` → `providers/transcription/`; mandatory `service.py` for profile/download; split `cover/` and `export/` modules out of `download/router.py`; auto-discover routers; nested settings groups; engine creation out of import time; `ig_http` → `httpx.AsyncClient` + cached cookie warmup; recorded-fixture tests for extractor/profile parsing. Regenerate the client (paths may move — frontend updates are mechanical because of Phase 3).
*Relieves: the shared/ grab bag before 22 more tools copy it; IG rate-limit exposure; untestability.*

**Phase 5 — Jobs platform + AI readiness**
`jobs/` package: Postgres `SELECT … FOR UPDATE SKIP LOCKED` queue + worker + startup reaper + per-tool concurrency; migration adding `user_id`, `params JSONB`, token/cost columns, indexes; `/zip` becomes a job; `core/cache.py` results cache. Scaffold `providers/llm/` (Protocol + registry + per-call model/tokens/latency logs) and the `prompts.py` + SSE conventions.
*Relieves: zombie jobs on deploy, open-wallet AI risk. Gate: must land before the first AI tool ships.*

**Phase 6 — Scaffolding + ergonomics**
`pnpm new-tool <slug>` generator (templates for the 10-file recipe in §4); root scripts `dev:web`/`dev:api` (turbo-filtered) + `quick-check`; secretlint/gitleaks pre-commit; CLAUDE.md updates: glossary (type names = canonical vocabulary), reusable-components table with paths, "never raw fetch in components" rule, the add-a-tool recipe.
*Relieves: recipe enforcement — the structure survives contact with tool #15 on a tired Friday.*

---

## 6. Decisions table

| # | Decision | Options surfaced by research | Picked | Why |
|---|---|---|---|---|
| 1 | Client data layer | TanStack Query (01,03,04,05) · hand-rolled hooks (binsr's actual practice) · SWR | **TanStack Query** | Unanimous across sources; binsr's hand-rolled `useCacheManager`/`useJobPolling`/listener registries are the documented cost of skipping it; job polling + cursor pagination are day-one needs it solves natively. |
| 2 | Hook style | `queryOptions` factories (TkDodo/05) · wrapper hooks per query (orval/binsr style) | **`queryOptions` factories**; custom hooks only when adding real logic (e.g. batch-transcribe pool) | Maintainer-endorsed; composes with the generated client; avoids 30 trivial `useX` wrappers. |
| 3 | Typed client | hey-api (05, FastAPI-endorsed) · orval · openapi-typescript types-only · keep hand-written | **hey-api `@hey-api/openapi-ts` + TanStack Query plugin** | Generates the exact `queryOptions`/`infiniteQueryOptions` style chosen in #2; ~16 reviewable files vs orval's thousands; types-only would keep the hand-maintained fetch layer forever. |
| 4 | Where generated code lives | inside `apps/web/src/client` · `packages/api-client` | **`packages/api-client` (workspace:\*)** | Keeps do-not-edit code out of app source; costs nothing with pnpm+turbo already set up; future consumers (worker, scripts) get it free. |
| 5 | Feature modules location | `apps/web/src/features/` (04,05) · `packages/features` (cal.com/binsr) | **In-app `src/features/`** | One web app today; cal.com only extracted because 3+ apps consume features. Extraction trigger documented in §3. |
| 6 | Tool registry | keep central `lib/tools.ts` · derive from per-feature `meta.ts` (cal.com) · codegen registry | **`features/registry.ts` importing each feature's `meta.ts`** | Keeps the best existing idea as the spine while ending dual-maintenance (7 pages hardcode what the registry knows). Codegen deferred to ~25+ tools. |
| 7 | Shared cross-tool data | allow cross-feature imports · duplicate queries per feature · shared `src/queries/` layer | **Shared `src/queries/` layer** | 4 tools consume profile-reels; cross-feature imports are banned (ESLint zones), and duplication is what we're fixing. Shared layer sits below features in the import direction. |
| 8 | Architecture enforcement | convention only · ESLint `import/no-restricted-paths` (05) | **ESLint zones from Phase 2** | At 30 tools it's the only thing preventing a dependency hairball; verbatim config exists. |
| 9 | Backend `shared/` split | leave as-is · `core/` + `integrations/` + `providers/` + `media/` (02) | **Split, with mandatory `service.py` per tool** | `shared/` already holds 2 tools' business logic; 22 more tools will copy whichever convention exists. |
| 10 | LLM layer | per-tool LLM calls · promote engines pattern to `providers/llm/` (02,03,04) | **`providers/llm/`** (Protocol + registry + lazy singletons) | The codebase's own best pattern, already proven for transcription; every AI tool gets provider swap, retries, and cost logs for free. |
| 11 | Job execution | keep in-process `create_task` · arq/Redis · Celery · Postgres `SKIP LOCKED` worker (02) | **Postgres `SKIP LOCKED` + reaper**; revisit Redis/arq when scale demands | No new infrastructure; fixes zombie jobs and enables separate worker processes; jobs table already in Postgres. Open question #1 may change this. |
| 12 | Event-loop blocking fix | rewrite on httpx-async first · plain `def` handlers first | **Plain `def` in Phase 0, httpx-async `ig_http` in Phase 4** | One-word change per handler removes the outage class immediately; the async rewrite is real work scheduled with the restructure. |
| 13 | Backend module granularity | force 1:1 with 7-tool registry (02) · status quo (3) · per-capability split | **Per-capability: split `cover/`, `export/` out of `download/`; composition tools (hashtags/ranking/overview) stay frontend-only** | 1:1 naming where a tool owns endpoints; forcing empty backend modules for pure compositions adds structure without value. |
| 14 | Router registration | manual `include_router` · auto-discover `tools/*/router.py` (02,04) | **Auto-discovery** | "Adding a tool touches no shared files" — cal.com's core property, trivially achievable at this scale. |
| 15 | Error contract | per-router try/except + `{detail}` · global handler + `{code,message}` + typed `ApiError` (01,02,03) | **Global handler end-to-end** | Cheapest consistency win; restores the machine-readable `error_code` the frontend needs for AI-tool failure UX. |
| 16 | AI streaming | poll-only · SSE alongside jobs (02) · WebSockets | **SSE alongside the jobs API** (convention now, build with first AI tool) | LLM tools feel broken without streaming; SSE pipes through the existing BFF proxy (bodies already stream). |
| 17 | `packages/types` | day one (03) · defer (04,05) | **Defer** | The generated client is the types package; binsr needed hand-written shared types for 3 apps — we don't. |
| 18 | Scaffolding | none · full codegen CLI (cal.com) · `pnpm new-tool` templates (01,04) | **`pnpm new-tool` script** | The 20% of cal.com's `create-app` that gives 80%; enforces the recipe instead of remembering it. |

---

## 7. Open questions for the product owner

1. **Deployment topology for workers.** Can production run a second process (worker) alongside the API — and is Redis available/acceptable infra? This decides Postgres-`SKIP LOCKED` (no new infra, picked as default) vs arq/Redis for the job queue, and how soon the worker is split from the web process.
2. **User model and quotas.** AI tools spend real money per request. Are tools staying free-for-all per signed-in user, or do we need per-user quotas/credits/billing? This decides how much of the `user_id` + token/cost schema work in Phase 5 is bookkeeping vs load-bearing (rate limiting, paywalls).
3. **Which AI tools ship first, on which providers?** Caption writer? Transcript summarizer? Content analyzer? And Anthropic vs OpenAI vs both? This prioritizes `providers/llm/` implementations and whether SSE streaming is needed for launch or polling suffices.
4. **Is a second consumer on any horizon** (mobile app, public API, embeds, CLI)? "No" confirms keeping features in-app and deferring `packages/types`/`packages/ui`; "yes within a year" moves the extraction triggers earlier.
5. **Backend URL stability.** The `cover/`/`export/` module split changes endpoint paths (e.g. `/tools/download/cover` → `/tools/cover/...`). The only consumer is our own frontend via the BFF proxy + generated client — confirm nothing external (scripts, bookmarks, monitors) depends on current paths.
6. **Generated-code policy.** Commit `packages/api-client/src` to git (reviewable diffs, CI drift check — the researched default) or generate on install/CI only? Committing is recommended; confirm tolerance for generated diffs in PRs.
7. **Registry `status` semantics.** Should `meta.ts` keep supporting `"soon"` (coming-soon tiles on the home grid, like the commented-out caption entry today), and should hidden/beta tools be a thing? Cheap to support, but it's a product call.
8. **Result caching scope and retention.** Caching transcripts/LLM outputs by `(tool, shortcode, params_hash)` saves money but stores derived user content. Any retention/privacy constraints before Phase 5 builds the results cache?

---

## What instagram-tools should take from this

1. **One uniform per-tool contract on both sides** — `features/<slug>/{meta,components,queries,types,index}` mirroring `tools/<slug>/{router,schemas,service}` — is the single property that keeps tools #9–#30 cheap (cal.com proved it 151 times; bulletproof-react is the same shape).
2. **TanStack Query + a hey-api-generated `packages/api-client`** replace `fetch`+`useState` and the 233-line `lib/api.ts`; Pydantic `schemas.py` becomes the only place types are written, and binsr's hand-rolled caching machinery is the scar we skip.
3. **The registry stays the spine but is derived** from per-feature `meta.ts` — sidebar, home grid, page headers, and metadata can never drift again.
4. **Promote the engines pattern to `providers/`** and split `shared/` into `core/`/`integrations/`/`media/` so the first AI tool inherits provider swapping, retries, and cost logging instead of inventing them.
5. **Fix the foundations before tool #9**: global error handler, non-blocking handlers, durable job queue + reaper, cached IG sessions — each is cheap now and an outage class at 30 tools.
6. **Enforce, don't remember**: ESLint import zones, CI schema-drift checks, secretlint, and `pnpm new-tool` make the structure self-maintaining; right-size everything else (no `packages/features`, no DI containers, no registry codegen) until a documented trigger fires.
