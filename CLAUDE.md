# CLAUDE.md — working in instagram-tools

A hosted collection of Instagram tools. This file is the contract for how the
codebase is built — read it before adding or changing anything, and keep it true
as the code evolves. Deeper rationale: `Architecture/04-scalable-structure-plan.md`
(decision record) and `Research/06-restructure/` (the research behind it).

---

## 1. What this is

- **Monorepo**, pnpm workspaces + Turborepo.
- `apps/web` — Next.js 16 (App Router) + shadcn/ui dashboard. The UI for every tool.
- `apps/api` — Python FastAPI backend. Does the real work (scraping, downloading,
  transcription, and — going forward — AI).
- `packages/api-client` — `@repo/api-client`, a **generated** TypeScript client
  (types + SDK) produced from the API's OpenAPI schema. The typed seam between
  the two apps.
- Planning/reference (not shipped): `Architecture/`, `Research/`, `Implementation/`,
  `ROADMAP.md`, `BACKLOG.md`.

How a reel flows through the system (the canonical example): user pastes a link →
web feature calls a query → BFF proxy (`/api/proxy`) validates the session and
forwards to FastAPI → a tool `service.py` orchestrates `integrations/` +
`providers/` + `media/` → result returns typed.

---

## 2. Commands

```bash
# dev (run both apps)
pnpm dev                 # web (:3000) + api (:8000) together
pnpm dev:web             # just Next.js
pnpm dev:api             # just FastAPI (uvicorn --reload)

# run with NO auth (no OAuth / DB session / internal key) — both apps, one var:
AUTH_DISABLED=true pnpm dev   # dev-only; ignored when NODE_ENV/ENVIRONMENT=production

# scaffolding
pnpm new-tool <slug>     # generate a whole tool, then run `pnpm gen`
pnpm new-tool <slug> --name "Display Name" --desc "One-liner"

# the typed client (run after ANY change to a Pydantic schema)
pnpm gen                 # export apps/api/openapi.json -> regenerate packages/api-client
pnpm gen:check           # regenerate and fail if it drifts (CI guard)

# verification (run before committing)
pnpm quick-check         # web: tsc + eslint  AND  api: ruff + pytest
pnpm --filter web exec tsc --noEmit
pnpm --filter web run lint
cd apps/api && .venv/bin/python -m pytest        # backend tests
cd apps/api && .venv/bin/ruff check app/ tests/  # backend lint
```

Backend Python lives in a venv at `apps/api/.venv` (Python 3.9 locally; prod is
3.11+). Runtime deps: `apps/api/requirements.txt` (pinned). Dev tools (pytest,
ruff): `apps/api/requirements-dev.txt`.

A `core.hooksPath` pre-commit (`.githooks/pre-commit`) runs `gitleaks` on staged
changes when it's installed (`brew install gitleaks`); it's a no-op otherwise.

---

## 3. Repo map

```
apps/web/src/
├── app/                         # ROUTING ONLY — no business logic, no fetch
│   ├── page.tsx                 # public landing page (/) — hero + tool showcase
│   ├── (auth)/sign-in/          # better-auth Google sign-in
│   ├── dashboard/               # the app, gated by middleware
│   │   ├── page.tsx             # home grid (renders from features/registry)
│   │   ├── layout.tsx           # sidebar + header
│   │   └── tools/<slug>/page.tsx# ~7-line shell: metadata + <SlugView/>
│   └── api/
│       ├── auth/[...all]/       # better-auth handler
│       └── proxy/[...path]/     # BFF proxy -> FastAPI (auth + internal key)
├── features/                    # ONE FOLDER PER TOOL (mirrors apps/api/app/tools)
│   ├── registry.ts              # collects each feature's meta -> sidebar + home
│   └── <slug>/
│       ├── meta.ts              # ToolMeta registry entry
│       ├── components/<slug>-view.tsx
│       ├── queries.ts           # TanStack Query factories over the SDK (optional)
│       ├── hooks/               # feature hooks (only when they add real logic)
│       ├── lib/                 # feature-local pure logic (e.g. hashtags analyze)
│       └── index.ts             # exports { meta, <Slug>View }
├── queries/                     # SHARED cross-tool query factories
│   ├── profile-reels.ts         # infinite query: cursor + shortcode de-dupe (4 tools)
│   ├── profile-info.ts
│   ├── jobs.ts                  # generic job polling (refetchInterval)
│   └── formats.ts
├── components/                  # SHARED components (ui/ = shadcn primitives)
├── hooks/                       # SHARED non-data hooks
├── providers/query-provider.tsx # QueryClient (retry policy keyed off ApiError)
└── lib/                         # tiny shared utils + auth + tool-meta type + api adapter

apps/api/app/
├── main.py                      # app factory; global ToolError handler; auto-discovers tools
├── core/                        # infrastructure: config, db (lazy), errors, auth, logging, cache
├── integrations/instagram/      # the no-login IG client: http, session(cached), extractor, profile, download, hashtags
├── media/                       # audio (ffmpeg), downloader (CDN + yt-dlp)
├── providers/
│   ├── transcription/           # local_whisper | openai | assemblyai
│   └── llm/                     # anthropic | openai (+ pricing) — for AI tools
├── jobs/                        # durable background work: handlers, queue, runner, reaper, worker, quota
├── models/                      # SQLAlchemy ORM (Job)
└── tools/<slug>/                # router.py + schemas.py + service.py  (the ONLY place product logic lives)

packages/api-client/
├── openapi-ts.config.ts         # codegen config (input: ../../apps/api/openapi.json)
└── src/
    ├── client.ts                # baseUrl=/api/proxy + error interceptor -> ApiError
    ├── index.ts                 # public surface (re-exports generated + ApiError)
    └── generated/               # DO NOT EDIT — types.gen.ts, sdk.gen.ts, client
```

---

## 4. The core pattern: a tool is a vertical slice

Every tool is a **feature module** in the web app that mirrors a **module** in
the API, with the **generated client** as the typed seam:

```
apps/web/src/features/<slug>/        apps/api/app/tools/<slug>/
├── meta.ts      registry entry      ├── schemas.py   Pydantic = TYPE SOURCE OF TRUTH
├── components/<slug>-view.tsx       ├── service.py   product logic
├── queries.ts   data hooks          └── router.py    thin transport (auto-discovered)
└── index.ts     exports
apps/web/src/app/dashboard/tools/<slug>/page.tsx   ~7-line server shell
```

**Backend granularity is per-capability, not 1:1 with the UI.** A frontend tool
that is pure composition over existing endpoints needs **no** backend module:
`hashtags`, `ranking`, `overview` all reuse the `profile` endpoints. Create a
backend module only when a tool owns new server work.

---

## 5. Adding a tool (the recipe)

```bash
pnpm new-tool best_time --name "Best Time to Post" --desc "When an account posts, and what lands."
pnpm gen        # regenerate the client: the bestTimeRun SDK fn now exists
pnpm quick-check
```

`pnpm new-tool` creates and wires everything:
- backend `tools/best_time/{__init__,schemas,service,router}.py`
- frontend `features/best_time/{meta,queries,components/best_time-view,index}.ts(x)`
- route `app/dashboard/tools/best_time/page.tsx`
- registers `bestTimeMeta` in `features/registry.ts`

Then you: implement `service.py`, flesh out the view, pick an icon in `meta.ts`.
The scaffold is a synchronous request→response tool. Make it a **job** (§8) or an
**AI tool** (§9) by following those sections.

Slug rules: lowercase, starts with a letter, words joined by `_` (it's a Python
module name *and* a URL segment), e.g. `best_time`. The generated SDK name is the
camelCase of `<slug>_run`, e.g. `bestTimeRun`.

---

## 6. The web data layer (TanStack Query + generated client)

**Rule: components never call `fetch`.** All data goes through query/mutation
factories that wrap the generated SDK. This gives caching, dedupe, retry-on-
transient, and typed errors for free.

- **Generated SDK** (`@repo/api-client`): one function per endpoint
  (`transcribeStart`, `profileListReels`, `downloadCover`, …). Configured to hit
  `/api/proxy` and throw `ApiError` on non-2xx.
- **`src/lib/api.ts`** is a thin adapter: ergonomic functions (`startTranscription`,
  `fetchProfileReels`, …) over the SDK, plus browser helpers (`imageDownloadUrl`,
  `downloadZip`, `transcribeReel`). It re-exports generated types under the names
  the app uses and re-exports `ApiError`.
- **`src/queries/*`** and feature `queries.ts`: `queryOptions` /
  `infiniteQueryOptions` factories (TkDodo style — factories, not wrapper hooks).
  Put behavior (de-dupe, `refetchInterval`) in `select`/options here, once.

Cross-tool data lives in `src/queries/` because **features must not import each
other** (enforced — see §11). Example: four tools share `profileReelsQuery`.

```ts
// reading a profile's reels in a view — no fetch, shared cache, errors toasted
const { username, setUsername, reels, isLoading, hasMore, loadMore, onSubmit } =
  useProfileReelsSearch();              // hooks/use-profile-reels-search.ts

// a one-shot mutation in a feature queries.ts
export function useCaption() {
  return useMutation({
    mutationFn: (input: string) => captionRun({ body: { input } }).then((r) => r.data),
  });
}
```

Errors: catch `ApiError` (has `status`, `code`, `message`, `retryable`) and toast
`err.message`. The `QueryClient` already retries only `retryable` failures.

After editing any `schemas.py`, run `pnpm gen` — never hand-edit types or
`packages/api-client/src/generated/`.

---

## 7. The backend (FastAPI, layered)

Product logic lives **only** in `tools/<slug>/`. Everything else is reusable
infrastructure it composes:

- `core/` — `config` (env settings; flat names, validated at startup; exposes
  `auth_bypassed` — `AUTH_DISABLED=true` + non-prod → skip auth, attribute to
  `dev_user_id`), `db` (Base + lazy engine/session — never created at import
  time), `errors` (`ToolError` taxonomy), `auth` (internal-key +
  `current_user_id` deps, both honor `auth_bypassed`),
  `logging`, `cache`.
- `integrations/instagram/` — the no-login client. `http` (request primitives),
  `session` (cookie warmup, cached process-wide), `extractor` (single reel),
  `profile` (info + cursor reels), `download` (yt-dlp ladder), `hashtags`.
- `media/` — `audio` (ffmpeg→wav), `downloader` (direct CDN + yt-dlp fallback).
- `providers/` — swap-by-config implementations: `transcription`, `llm`.
- `jobs/` — the durable background-work platform (§8).

A tool module:
- `schemas.py` — Pydantic request/response models. **The only place API types are
  written.** Keep fields well-typed (optional fields become `| undefined` in TS).
- `service.py` — the logic, a plain callable. Composes integrations/providers/
  media/cache. Raise `ToolError` subclasses for expected failures.
- `router.py` — thin. `prefix="/tools/<slug>"`, `tags=["<slug>"]`,
  `dependencies=[Depends(require_internal_key)]`. **Plain `def`** handlers for
  blocking work (FastAPI thread-pools them); `async def` only for genuinely async
  work or job dispatch. Routers are **auto-discovered** by `main.py` — never edit
  `main.py` to add a tool.

**Error handling: raise, don't catch.** One global handler in `main.py` turns any
`ToolError` into `{code, message}` with the right status. Routers have no
try/except. Add a new failure mode by subclassing `ToolError` in `core/errors.py`:

```python
class PrivateContentError(ToolError):
    code = "private"
    http_status = 422
```

The `code` reaches the frontend as `ApiError.code`, so the UI can branch on it.

---

## 8. Jobs (durable background work)

Use a job for anything that can take more than a request should (transcription,
zips, every AI call). Jobs are **durable data**, not closures: a row stores
`tool` + `params`, and a registered handler reconstructs the work.

```python
# tools/<slug>/service.py — register the handler (import-time side effect)
from app.jobs.handlers import job_handler, HandlerResult

@job_handler("caption")
def run_job(params: dict) -> HandlerResult | dict:
    text = do_work(params["url"])
    return {"text": text}            # plain dict, or HandlerResult(...) with cost
```

```python
# tools/<slug>/router.py — enqueue + dispatch, attribute to the user
from app.core.auth import current_user_id, require_internal_key
from app.jobs.queue import enqueue, get_job
from app.jobs.quota import check_quota
from app.jobs.runner import dispatch

@router.post("", response_model=JobResponse)
async def start(req, db=Depends(get_db), user_id=Depends(current_user_id)):
    check_quota(db, user_id, "caption")
    job = enqueue(db, tool="caption", params={"url": req.url}, user_id=user_id)
    dispatch(job.id)                 # in-process today; a worker can claim instead
    return _to_response(job)
```

Frontend polls with the shared job query (`refetchInterval` stops at terminal
status): `useQuery(jobQuery(jobId))`.

Mechanics:
- `enqueue` inserts `pending` with params + `user_id`. `dispatch` runs it in a
  thread off the event loop (the default). `complete`/`fail` persist the outcome
  (result + `tokens_in/out` + `cost_cents`).
- **Reaper**: on startup, jobs stuck `running` (process died) are marked
  `interrupted`. Pending jobs are left for a worker.
- **Separate worker** (when topology is decided): `python -m app.jobs.worker`
  claims via `SELECT … FOR UPDATE SKIP LOCKED` and runs the same `execute()`. No
  tool code changes.
- **Quota/billing**: `user_id` + `cost_cents` columns are load-bearing (paid
  product). `jobs/quota.py::check_quota` is the single enforcement seam.

---

## 9. AI tools (LLM)

An AI tool is a normal (usually job-based) tool that additionally:

- **Calls the LLM through the provider layer**, never a vendor SDK directly:
  ```python
  from app.providers.llm import get_llm, Message, estimate_cost_cents
  from app.core.config import settings

  llm = get_llm(settings.llm_provider)            # "anthropic" | "openai"
  res = llm.complete([Message("system", SYSTEM), Message("user", prompt)])
  # res.text, res.tokens_in, res.tokens_out, res.model
  ```
  Both Anthropic and OpenAI ship; the SDKs import lazily (only needed when used).
  Add `anthropic`/`openai` to `requirements.txt` and set the key + `LLM_PROVIDER`.
- **Records spend** so quota/billing works:
  ```python
  cost = estimate_cost_cents(res.model, res.tokens_in, res.tokens_out)
  return HandlerResult(result={"text": res.text},
                       tokens_in=res.tokens_in, tokens_out=res.tokens_out, cost_cents=cost)
  ```
- **Keeps prompts in `tools/<slug>/prompts.py`** (versioned with the tool).
- **Caches** to avoid re-spending: `app.core.cache.results.get_or_set(make_key("caption", shortcode, params), factory)`.
- **Streaming** (optional): add a `GET /stream` SSE endpoint (the BFF proxy
  already streams bodies). Build the SSE plumbing with the first tool that needs it.

Update token pricing in `providers/llm/pricing.py` when vendor prices change.

---

## 10. The generated client workflow

1. Edit a Pydantic `schemas.py` (or add a router).
2. `pnpm gen` → exports `apps/api/openapi.json` (via `scripts/export_openapi.py`,
   which sets placeholder env so it imports without infra) → regenerates
   `packages/api-client/src/generated/`.
3. The new/changed SDK function + types are now available to import.

- Operation IDs are `"<tag>_<routename>"` (set by `generate_unique_id_function`),
  so a POST handler `run` under tag `caption` → `caption_run` → SDK `captionRun`.
- The internal-key header is `include_in_schema=False` — it must never appear in
  the contract (the BFF injects it). Same for `x-user-id`.
- Generated code is **committed** (reviewable diffs + `pnpm gen:check` drift
  guard in CI). Never hand-edit it.
- `next.config.ts` has `transpilePackages: ["@repo/api-client"]` (it's consumed
  as TS source).

---

## 11. Architecture rules (enforced where possible)

Import direction (ESLint `import/no-restricted-paths`, see `eslint.config.mjs`):

```
components/ui      → nothing domain-specific
lib, hooks, queries, components, providers  → may use ui + @repo/api-client;
                                              may import features/registry.ts (the
                                              manifest) but NOT individual features;
                                              never app/
features/<a>       → shared layers + @repo/api-client; NEVER features/<b>; never app/
app/               → consumes features (the only place that imports a feature's index)
```

The cross-feature and shared→feature rules are verified to fire. If you need data
from another tool, lift it into `src/queries/` or `src/lib/`.

Backend conventions: product logic only in `tools/`; tools never import other
tools; raise `ToolError` (no try/except in routers); `def` for blocking handlers;
no import-time side effects (engine, clients are lazy).

---

## 12. Testing

Backend (`apps/api/tests/`, pytest): deterministic units that need no live
Instagram or API keys — parsing (shortcode/hashtags/cursor/error-classification/
selectors), settings validation, the jobs platform (enqueue/claim/complete/fail/
reaper on in-memory SQLite), cache, the LLM registry, and app wiring
(auto-discovery, the ToolError handler, the internal-key dep). Add tests for new
pure logic and job handlers; mirror the SQLite-session fixture in `test_jobs.py`.

`conftest.py` sets placeholder env so imports never need real infra. The job
model uses a cross-dialect JSON type (`JSONB` on Postgres, `JSON` on SQLite) so
the queue is testable without Postgres.

Web: `tsc --noEmit` + eslint are the gate today. `pnpm quick-check` runs everything.

---

## 13. Gotchas

- **SQLAlchemy `Mapped[]` needs `Optional[...]`, not `X | None`** — those
  annotations are evaluated at runtime and PEP 604 unions break on Python 3.9
  (`models/job.py`). Everywhere else, `X | None` with `from __future__ import
  annotations` is fine and is the project style (ruff enforces it).
- **`pnpm gen` reorders generated files** if router registration order changes
  (auto-discovery is alphabetical). The exported *symbols* don't change, so the
  frontend is unaffected — but the diff is real; commit it.
- **Optional Pydantic fields → `T | null | undefined` in TS.** Widen helper
  signatures or guard with `?? default`; don't assume presence.
- **`set-state-in-effect` is an error** (newer eslint-plugin-react-hooks). Reset
  state on a prop change with the render-phase pattern (`if (x !== prev) {…}`),
  not a `useEffect`.
- **Don't reintroduce `lib/tools.ts`** — the registry is derived from per-feature
  `meta.ts` via `features/registry.ts`.
- **Hosting reality**: the no-login IG technique is verified from a residential
  IP. A data-center host needs `IG_COOKIES_FILE` or residential/mobile proxies
  (`Research/02`, `Research/05`, `BACKLOG.md`).

---

## 14. Reuse before you write (web)

| Need | Use |
|---|---|
| Centered page width wrapper | `components/tool-page-shell.tsx` (tool name shows in the app bar via `header-title.tsx`, not on the page) |
| @username search card | `components/username-search-form.tsx` |
| Reel URL input card | `components/reel-url-form.tsx` |
| Big-number stat tile | `components/stat-card.tsx` |
| Instagram CDN `<img>` | `components/instagram-image.tsx` |
| A profile's reels (cursor + de-dupe) | `queries/profile-reels.ts` + `hooks/use-profile-reels-search.ts` |
| Profile info | `queries/profile-info.ts` |
| Job polling | `queries/jobs.ts` |
| Download formats | `queries/formats.ts` |
| Compact numbers (1.2K/3.4M) | `lib/format.ts` |
| Trigger a browser download / blob | `lib/download.ts` |
| Copy-to-clipboard w/ checkmark | `hooks/use-copy-to-clipboard.ts` |
| Instagram URL regex | `lib/instagram.ts` |

Backend: reuse `integrations/instagram/*`, `media/*`, `providers/*`,
`core/cache`, and the `jobs/*` platform before writing new infra.

---

## 15. Glossary (canonical names — reuse, don't re-coin)

- **tool** — one feature module + (optional) backend module, listed in `features/registry.ts`.
- **meta** — a tool's `ToolMeta` (`lib/tool-meta.ts`): `slug`, `name`, `description`, `icon`, `status`.
- **registry** — `features/registry.ts`; drives the sidebar + home grid.
- **ApiError** — typed client error (`@repo/api-client`): `{status, code, message, retryable}`.
- **ToolError** — backend typed failure (`core/errors.py`); subclasses set `code` + `http_status`.
- **job** — durable background work row (`app/jobs`): `tool` + `params` → handler → result + cost.
- **handler** — a `@job_handler("<tool>")` callable that runs a job from its params.
- **provider** — a config-selected swappable impl: `providers/transcription`, `providers/llm`.
- **integration** — an external-system client: `integrations/instagram`.
- **BFF proxy** — `app/api/proxy/[...path]`; validates the session, injects the
  internal key + `x-user-id`, forwards to FastAPI.
