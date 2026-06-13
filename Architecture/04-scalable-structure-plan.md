# 04 — Scalable Structure Plan (the restructure)

> Decision record. Full research + reasoning lives in `Research/06-restructure/`
> (read its README for the doc order). Status: **approved 2026-06-13** — open
> questions answered (see bottom). Ready for Phase 0.

## Why restructure

Verified in the audits (`Research/06-restructure/01` + `02`):

- Every tool page is a fat `"use client"` component owning fetch + state + UI;
  the username-search/pagination flow is copy-pasted across 4 pages (~240 LOC),
  and headers/stat-cards/formatters exist in 3–7 copies.
- No query/cache layer at all — 4 tools re-scrape the same profile reels; job
  polling is a leak-prone hand-rolled loop.
- Types are hand-synced with the Pydantic schemas; the backend's `error_code`
  is silently dropped on the way to the UI.
- Backend: blocking sync I/O inside `async def` (one 50-reel zip freezes the
  instance), fire-and-forget jobs that orphan on restart, `shared/` holding two
  tools' business logic, the error mapping copy-pasted 6+ times, zero tests,
  zero logging.
- None of the AI-tool prerequisites exist (LLM provider layer, cost tracking,
  durable jobs, caching, streaming).

At 8 tools this is annoying; at 30 it's fatal. Fix the pattern before tool #9.

## The design (one paragraph)

Every tool becomes a **feature module** `apps/web/src/features/<slug>/`
(`meta.ts`, `components/`, `queries.ts`, `index.ts`) mirroring a backend module
`apps/api/app/tools/<slug>/` (`router.py`, `schemas.py`, `service.py`,
`prompts.py` for AI tools). **TanStack Query** is the data layer
(`queryOptions` factories; shared cross-tool factories in `src/queries/`).
Types + client are **generated** from FastAPI's OpenAPI spec via
`@hey-api/openapi-ts` into `packages/api-client` — Pydantic `schemas.py`
becomes the single source of truth for types in both stacks. The tool registry
survives as `features/registry.ts`, derived from each feature's `meta.ts`.
Backend `shared/` splits into `core/` + `integrations/instagram/` +
`providers/{transcription,llm}/` + `media/`; a global `ToolError` handler
returns `{code, message}`; jobs move to a Postgres `SKIP LOCKED` queue with a
startup reaper. ESLint `import/no-restricted-paths` enforces
`shared → features → app`, and `pnpm new-tool` scaffolds the whole recipe.

Full annotated trees: `Research/06-restructure/06-proposed-structure.md` §1–2.

## Key decisions (short version — full 18-row table in 06 §6)

| Decision | Picked |
|---|---|
| Data layer | TanStack Query, `queryOptions` factories (not wrapper hooks) |
| Typed client | hey-api + TanStack Query plugin → `packages/api-client` (workspace:*) |
| Feature modules | In-app `src/features/` — NOT extracted to packages (one web app today) |
| Registry | `features/registry.ts` derived from per-feature `meta.ts` |
| Packages now | Exactly one: `api-client`. types/ui/features deferred with documented triggers |
| Backend layout | `core/` + `integrations/instagram/` + `providers/` + `media/` + `tools/<slug>/` with mandatory `service.py` |
| Backend granularity | Per-capability (split `cover/`, `export/` from `download/`); composition tools (hashtags/ranking/overview) stay frontend-only |
| Jobs | Postgres `SELECT … FOR UPDATE SKIP LOCKED` + reaper + user/cost columns; Redis deferred |
| Blocking I/O | Plain `def` handlers in Phase 0; httpx-async rewrite in Phase 4 |
| Errors | One global handler → `{code, message}`; typed `ApiError` client-side |
| AI readiness | `providers/llm/` (the engines pattern promoted), `prompts.py` per tool, SSE convention, results cache — gated before the first AI tool |
| Enforcement | ESLint import zones, CI schema-drift check, `pnpm new-tool` scaffold |

## Migration phases (each shippable; detail in 06 §5)

0. ✅ **Hygiene + sharp edges** (done 2026-06-13) — global error handler,
   plain-`def` handlers, pinned deps, logging + request IDs, fail-fast
   settings; proxy hardening (all methods, TTL session cache, timeout/abort).
1. **TanStack Query layer** — over the existing `api.ts`; shared
   profile-reels/jobs query factories; kills duplicate scrapes + polling loop.
2. **Feature modules + shared components** — thin pages, `meta.ts` registry,
   extract the 8 duplicated components/utils; ESLint zones land here.
3. **Generated client** — `packages/api-client`, delete `lib/api.ts`,
   `pnpm gen` + CI drift check.
4. **Backend restructure** — split `shared/`, promote providers, httpx-async,
   fixture tests.
5. **Jobs platform + AI readiness** — durable queue, reaper, per-user cost
   columns + usage ledger (paid product is planned — this is billing
   foundation, not bookkeeping), quota hooks on enqueue, `providers/llm/` with
   both Anthropic + OpenAI, cache. **Must land before the first AI tool ships.**
6. **Scaffolding** — `pnpm new-tool`, root scripts, CLAUDE.md recipe.

## Acceptance test

"Adding tool #9" (an AI caption writer) = ~10 small files, zero shared files
edited, no hand-written types, jobs/errors/cost-tracking inherited. Full
walkthrough: 06 §4.

## Open questions — ANSWERED 2026-06-13

1. **Hosting:** Fly.io; worker topology not decided yet. → Postgres `SKIP LOCKED`
   confirmed as the right call: it works single-process today, and Fly.io
   `[processes]` groups (`app` + `worker` sharing the image) make splitting the
   worker out a fly.toml change, not a code change. Redis stays deferred.
2. **Billing: PAID PRODUCT PLANNED.** The Phase 5 user/cost schema is
   load-bearing, not bookkeeping: `user_id`, `tokens_in/out`, `cost_cents` on
   every job from day one, plus a `credits`/usage-ledger design in Phase 5 so
   billing bolts on without a data migration. Quota enforcement hooks (per-user
   daily caps) built into the job-enqueue path, even if limits start at ∞.
3. **LLM providers: BOTH Anthropic + OpenAI from day one** — `providers/llm/`
   ships `anthropic.py` and `openai.py` in Phase 5; per-tool model choice is a
   config string (the engines pattern already proves this).
4. **Second consumer: no, not within a year.** Confirms features stay in
   `apps/web/src/features/`; `packages/types`/`ui` extraction triggers stand.
5. **Endpoint paths:** nothing is hosted yet and the only consumer is our own
   frontend via the BFF proxy — the `cover`/`export` split is safe. (Decided.)
6. **Generated client: committed to git** with CI drift check. (Decided.)
7. **Registry statuses:** keep `"soon"` support — cheap, already half-exists. (Decided.)
8. **Cache retention:** default 30-day TTL on cached transcripts/LLM results;
   revisit with a real privacy pass before public paid launch. (Decided.)
