# CLAUDE.md — working in instagram-tools

Hosted Instagram toolset. **Monorepo** (pnpm + Turborepo): `apps/web` (Next.js 16
+ shadcn dashboard) + `apps/api` (Python FastAPI) + `packages/api-client`
(generated typed client). Architecture decisions live in
`Architecture/04-scalable-structure-plan.md`; research in `Research/06-restructure/`.

## Commands
```bash
pnpm dev                 # web + api together
pnpm new-tool <slug>     # scaffold a whole tool (then `pnpm gen`)
pnpm gen                 # export OpenAPI -> regenerate packages/api-client
pnpm quick-check         # web tsc+lint AND api ruff+pytest (run before committing)
```
Backend venv lives at `apps/api/.venv`. Tests: `cd apps/api && .venv/bin/python -m pytest`.

## The one pattern that matters: a tool is a vertical slice
Every tool is a **feature module** in the web app that mirrors a **module** in the
API, with the **generated client** as the typed seam between them:

```
apps/web/src/features/<slug>/        apps/api/app/tools/<slug>/
├── meta.ts      (registry entry)    ├── schemas.py   (Pydantic = TYPE SOURCE OF TRUTH)
├── components/<slug>-view.tsx       ├── service.py   (product logic)
├── queries.ts   (TanStack Query)    └── router.py    (thin transport; auto-discovered)
└── index.ts     (exports meta+View)
apps/web/src/app/(dashboard)/tools/<slug>/page.tsx   (~7-line shell)
```

A frontend tool that is pure composition over existing endpoints needs **no**
backend module (e.g. `hashtags`/`ranking`/`overview` reuse `profile`).

## Adding a tool
1. `pnpm new-tool <slug>` — scaffolds backend + feature + page, registers it.
2. `pnpm gen` — regenerates the typed client (the new SDK function appears).
3. Implement `tools/<slug>/service.py` and flesh out `<slug>-view.tsx`; pick an icon in `meta.ts`.
4. `pnpm quick-check`.

## Rules (these keep the structure from rotting)
- **Never `fetch` in a component.** Data goes through `src/queries/*` factories
  (TanStack Query) which wrap the generated SDK. Errors are typed `ApiError`.
- **Never hand-write API types.** They come from `@repo/api-client`, generated
  from `apps/api/app/tools/*/schemas.py`. Change the Pydantic model, run `pnpm gen`.
- **Features never import other features** (ESLint `import/no-restricted-paths`
  enforces it). Shared code lives in `src/{components,hooks,queries,lib}`; cross-
  tool data lives in `src/queries/`. Shared layers may import the registry but no
  individual feature.
- **Backend: raise `ToolError` subclasses**, never try/except in routers — the
  global handler in `main.py` returns `{code, message}`. Routers are
  auto-discovered; don't edit `main.py` to add a tool.
- **Long work → a job** (`app/jobs`): `enqueue(tool, params, user_id)` +
  register a `@job_handler`. Don't block a request on minutes of work.
- **AI tools**: call `app.providers.llm.get_llm(...)` (never a vendor SDK
  directly), put prompts in `tools/<slug>/prompts.py`, return `HandlerResult`
  with `cost_cents`, cache via `app.core.cache`. See `apps/api/README.md`.
- **Backend layering**: product logic only in `tools/<slug>/`; reuse
  `core/` · `integrations/instagram/` · `media/` · `providers/` · `jobs/`.

## Reuse before you write (web)
| Need | Use |
|---|---|
| Page header + width wrapper | `components/tool-page-shell.tsx` |
| @username search card | `components/username-search-form.tsx` |
| Reel URL input card | `components/reel-url-form.tsx` |
| Big-number stat tile | `components/stat-card.tsx` |
| Instagram CDN `<img>` | `components/instagram-image.tsx` |
| A profile's reels (cursor + de-dupe) | `queries/profile-reels.ts` + `hooks/use-profile-reels-search.ts` |
| Profile info | `queries/profile-info.ts` |
| Job polling | `queries/jobs.ts` |
| Compact numbers (1.2K/3.4M) | `lib/format.ts` |
| Trigger a browser download | `lib/download.ts` |
| Copy-to-clipboard w/ checkmark | `hooks/use-copy-to-clipboard.ts` |
| Instagram URL regex | `lib/instagram.ts` |

## Glossary (canonical names — reuse, don't re-coin)
- **tool** — one feature module + (optional) backend module, listed in `features/registry.ts`.
- **meta** — a tool's `ToolMeta` (`lib/tool-meta.ts`): slug, name, description, icon, status.
- **ApiError** — typed client error (`@repo/api-client`) carrying `{status, code, retryable}`.
- **ToolError** — backend typed failure (`core/errors.py`); subclasses set `code` + `http_status`.
- **job** — durable background work row (`app/jobs`): `tool` + `params` → handler → result + cost.
- **provider** — a swappable implementation chosen by config: `providers/transcription`, `providers/llm`.
- **integration** — an external system client: `integrations/instagram`.
