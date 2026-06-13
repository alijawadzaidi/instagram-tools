# Industry Patterns Research: Scalable Frontend Structure for instagram-tools

> Research date: 2026-06-13. Sources fetched live from official docs and respected community references.
> Scope: (1) bulletproof-react feature folders, (2) TanStack Query organization, (3) Next.js App Router
> project structure, (4) typed API client generators for FastAPI OpenAPI, (5) Python↔TS type sharing in monorepos.

---

## 1. bulletproof-react: the feature-folder standard

**Source:** [github.com/alan2207/bulletproof-react — docs/project-structure.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) (fetched raw from master).

bulletproof-react is the most-cited reference architecture for React apps (~30k+ stars). Its core claim: most of the code lives in `features/`, and shared folders only hold things genuinely used app-wide.

### 1.1 Top-level structure (verbatim from docs)

```sh
src
|
+-- app               # application layer:
|   +-- routes        # application routes / pages
|   +-- app.tsx       # main application component
|   +-- provider.tsx  # global providers wrapper
|   +-- router.tsx    # router configuration
+-- assets            # static files (images, fonts, etc.)
+-- components        # shared components used across the entire application
+-- config            # global configurations, exported env variables
+-- features          # feature based modules        <-- the heart of the architecture
+-- hooks             # shared hooks
+-- lib               # reusable libraries preconfigured for the application
+-- stores            # global state stores
+-- testing           # test utilities and mocks
+-- types             # shared types
+-- utils             # shared utility functions
```

### 1.2 Per-feature structure (verbatim)

```sh
src/features/awesome-feature
|
+-- api         # API request declarations + api hooks for this feature
+-- assets      # static files scoped to the feature
+-- components  # components scoped to the feature
+-- hooks       # hooks scoped to the feature
+-- stores      # state scoped to the feature
+-- types       # types used within the feature
+-- utils       # utilities for the feature
```

Key point from the docs: **every folder inside a feature is optional** — a small feature might only have `api/` and `components/`. This is exactly the "adding a tool is cheap" property instagram-tools needs.

### 1.3 Unidirectional imports, enforced by ESLint

The dependency rule is **`shared → features → app`**:

- Shared modules (`components`, `hooks`, `lib`, `types`, `utils`) may be imported by anything.
- Features may NOT import from other features (cross-feature imports banned).
- Features may NOT import from the app layer.

Enforced with `eslint-plugin-import` `import/no-restricted-paths` zones (verbatim from docs):

```js
// no cross-feature imports:
{ target: './src/features/auth', from: './src/features', except: ['./auth'] },

// features can't import app:
{ target: './src/features', from: './src/app' },

// shared can't import features/app:
{
  target: ['./src/components', './src/hooks', './src/lib', './src/types', './src/utils'],
  from: ['./src/features', './src/app'],
},
```

### 1.4 The Next.js sample inside bulletproof-react

**Source:** [bulletproof-react/apps/nextjs-app/src](https://github.com/alan2207/bulletproof-react/tree/master/apps/nextjs-app/src).

The repo ships a real Next.js App Router sample whose `src/` is:

```
src/
  app/          # Next.js App Router — routing only, thin pages
  components/
  config/
  features/     # discussions, comments, auth, users... — all real logic
  hooks/
  lib/
  styles/
  testing/
  types/
  utils/
```

The pattern to copy: **`app/` is purely routing; pages import a screen/composition from `features/<x>`**. The page file is a few lines; the feature module owns components, queries, and types.

---

## 2. TanStack Query organization conventions

**Sources:** [TkDodo — Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys), [TkDodo — The Query Options API](https://tkdodo.eu/blog/the-query-options-api). TkDodo (Dominik Dorfmeister) is a TanStack Query maintainer; these posts are the de-facto convention reference.

### 2.1 Co-locate query keys with features

Direct quote: *"I keep my Query Keys next to their respective queries, co-located in a feature directory."* — i.e., NOT a global `queryKeys.ts`. Each feature owns its keys:

```
src/features/profile/
  api/
    profile.queries.ts   # keys + queryOptions for this feature only
```

### 2.2 Query key factories — generic → specific

The canonical factory (verbatim):

```ts
const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: string) => [...todoKeys.lists(), { filters }] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: number) => [...todoKeys.details(), id] as const,
}
```

Structuring keys generic→specific lets you invalidate at any granularity (`invalidateQueries({ queryKey: todoKeys.lists() })`). Caveat from the post: never reuse the same key for `useQuery` and `useInfiniteQuery` (shared cache, different data shapes) — relevant to instagram-tools' cursor-paginated reels endpoints.

### 2.3 The modern form: `queryOptions` factories (v5)

`queryOptions()` co-locates `queryKey` + `queryFn` + options in one typed object, usable everywhere (`useQuery`, `prefetchQuery`, `useSuspenseQuery`), and adds a `DataTag` so `getQueryData()` is fully typed with no manual generics:

```ts
const todosQuery = queryOptions({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  staleTime: 5000,
})

useQuery(todosQuery)
queryClient.prefetchQuery(todosQuery)
```

TkDodo's current recommendation merges key factories and query options into a single **query factory per feature**:

```ts
const todoQueries = {
  all: () => ['todos'],
  list: (filters) => queryOptions({
    queryKey: ['todos', 'list', filters],
    queryFn: () => fetchTodos(filters),
  }),
}
```

He also explicitly advises **against custom hooks that merely wrap `useQuery`** — export the `queryOptions` factory and call `useQuery(profileQueries.detail(username))` in the component. Reserve custom hooks for cases that add real logic (select, derived state, combined queries).

### 2.4 Where this lives relative to features

Convention that falls out of 2.1–2.3:

```
features/<feature>/api/<entity>.queries.ts   # query factory: keys + queryOptions
features/<feature>/api/<entity>.mutations.ts # mutation functions / mutationOptions
```

Mutations invalidate using the same factory's key-only entries (`queryClient.invalidateQueries({ queryKey: todoQueries.all() })`).

---

## 3. Next.js App Router project-structure guidance

**Source:** [nextjs.org/docs/app/getting-started/project-structure](https://nextjs.org/docs/app/getting-started/project-structure) (v16.2.9 docs, updated 2025-12-09).

The official position: *"Next.js is **unopinionated** about how you organize and colocate your project files"* — but it documents three sanctioned strategies and the primitives that make them safe.

### 3.1 The primitives

- **Safe colocation:** a route is only public when `page.js`/`route.js` exists; *"project files can be safely colocated inside route segments in the `app` directory without accidentally being routable."* Only the content **returned** by `page.js` is sent to the client.
- **Private folders (`_folder`):** opt a folder and all subfolders out of routing entirely. Docs list uses: separating UI logic from routing logic, consistent organization, avoiding naming clashes with future Next conventions. Example from docs: `app/blog/_components/Post.tsx`, `app/blog/_lib/data.ts`.
- **Route groups (`(group)`):** organizational folders omitted from the URL; used for sectioning (marketing vs shop vs dashboard), opting subsets of routes into a layout, scoping a `loading.tsx`, or multiple root layouts. instagram-tools already uses this correctly with `app/(dashboard)/`.
- **`src/` folder:** officially supported; separates app code from config. Already in use.

### 3.2 The three documented strategies

1. **Store project files outside of `app`** — `app/` is purely routing; everything else in root-level shared folders. *(This is the bulletproof-react alignment.)*
2. **Top-level folders inside `app`** — `app/components`, `app/lib`, etc.
3. **Split by feature or route** — globally shared code at `app/` root, route-specific code colocated inside the route segment (often in `_components`/`_lib` private folders).

Docs verdict: *"choose a strategy that works for you and your team and be consistent across the project."*

### 3.3 Community consensus for 2025/2026 (route groups vs feature modules)

The widely-repeated guidance across bulletproof-react's nextjs-app, TkDodo's writing, and the next-forge/Turborepo starter ecosystem:

- **Route groups organize URLs and layouts; feature modules organize code.** Don't try to make the `app/` tree your domain model.
- For apps beyond toy size, **strategy 1 (app = routing shell, `src/features/*` = logic)** scales best, because route files stay tiny, features are testable without the router, and Server/Client component boundaries stay obvious (page = server shell, feature components marked `"use client"` as needed).
- Strategy 3 (colocating in `_components` per route) is fine for small apps but couples code to URL structure — painful when 20–30 tools start sharing pieces (e.g., a `ReelGrid` used by both `ranking` and `profile`).

---

## 4. Typed API clients from a FastAPI OpenAPI schema

### 4.1 What FastAPI itself recommends

**Source:** [fastapi.tiangolo.com/advanced/generate-clients](https://fastapi.tiangolo.com/advanced/generate-clients/).

FastAPI's official docs name **Hey API (`@hey-api/openapi-ts`)** first: *"a purpose-built solution, providing an optimized experience for the TypeScript ecosystem."* Workflow:

```bash
npx @hey-api/openapi-ts -i http://localhost:8000/openapi.json -o src/client
```

Two FastAPI-side preparations the docs insist on (both directly applicable to `apps/api`):

```python
# clean operation IDs -> clean generated function names
from fastapi.routing import APIRoute

def custom_generate_unique_id(route: APIRoute):
    return f"{route.tags[0]}-{route.name}"

app = FastAPI(generate_unique_id_function=custom_generate_unique_id)
```

- **Tag every router** (`tags=["transcribe"]`, `tags=["profile"]`, ...) — generators split the client by tag, which maps 1:1 onto the tool modules already in `apps/api/tools/<name>/router.py`.
- Optionally post-process `openapi.json` to strip the `tag-` prefix from operation IDs for even cleaner names (script given in docs).

### 4.2 Tool comparison

**Sources:** [DEV — Which OpenAPI Codegen Should You Choose? (openapi-typescript vs hey-api vs Orval vs Kubb)](https://dev.to/nyaomaru/which-openapi-codegen-should-you-choose-openapi-typescript-vs-hey-api-vs-orval-vs-kubb-100p), [Typesafe API Code Generation for React in 2026 — saschb2b.com](https://www.saschb2b.com/blog/typesafe-api-codegen-2026), [Hey API TanStack Query plugin docs](https://heyapi.dev/openapi-ts/plugins/tanstack-query), [orval.dev](https://orval.dev/).

| | openapi-typescript (+openapi-fetch) | **hey-api (`@hey-api/openapi-ts`)** | orval | kubb |
|---|---|---|---|---|
| Output style | Types only, 1 file (fastest: ~1.5s) | Compact SDK: typed functions per operationId + shared types (~16 files) | Generated hooks per endpoint, tag-split (2,719 files / 14MB in benchmark) | 1 file per operation (3,877 files; slowest) |
| TanStack Query | No (hand-write `queryOptions` over `openapi-fetch`) | **Plugin: generates `queryOptions`/`mutationOptions`/`infiniteQueryOptions`/`queryKey` fns** | Built-in, but generates `useX` hooks (the pattern TkDodo advises against) | Plugin |
| Zod / MSW / Faker | No | Zod plugin; weaker MSW | Strong MSW/Zod/Faker | Strong MSW/Faker |
| Call shape | URL-string keyed paths | Consistent `{ path, query, body }` args; interceptors | Hooks; default fetch doesn't throw on 4xx/5xx, auth needs custom mutator | Plugin-driven |
| Notes | Thin and fast, zero SDK | Spiritual successor to openapi-typescript-codegen; named in FastAPI docs; multi-framework (React/Vue/Svelte/Solid) from one output | Mature, mock-heavy ecosystems | Architecture control over speed |

### 4.3 The hey-api TanStack Query plugin (why it wins here)

**Source:** [heyapi.dev/openapi-ts/plugins/tanstack-query](https://heyapi.dev/openapi-ts/plugins/tanstack-query).

Config:

```js
// openapi-ts.config.ts
export default {
  input: 'http://localhost:8000/openapi.json',
  output: 'src/client',   // or a workspace package, see §5
  plugins: [
    {
      name: '@tanstack/react-query',
      queryOptions: true,
      mutationOptions: true,
      infiniteQueryOptions: true,
      queryKeys: true,
    },
  ],
};
```

Generated usage in components — note this is exactly TkDodo's recommended options-spreading style, not wrapper hooks:

```ts
const query = useQuery({ ...getPetByIdOptions({ path: { petId: 1 } }) })
const addPet = useMutation({ ...addPetMutation() })
addPet.mutate({ body: { name: 'Kitty' } })
```

It also emits `...QueryKey` / `...InfiniteQueryKey` helpers with normalized params for cache invalidation, and `infiniteQueryOptions` for paginated endpoints — directly useful for the cursor-paginated profile-reels/hashtag endpoints already in instagram-tools.

**Recommendation: hey-api.**
- Officially endorsed by FastAPI docs for this exact pairing.
- Generates `queryOptions` (the TanStack-maintainer-endorsed pattern) instead of orval's `useX` hooks, so generated code composes with hand-written feature query factories.
- Output is small enough to keep generated code reviewable (16 files vs orval's thousands).
- openapi-typescript remains the runner-up if you want types-only and to hand-write the fetch layer — but then you hand-maintain the 233-line `lib/api.ts` problem forever, just with better types.

---

## 5. Sharing types between a Python backend and TS frontend in a monorepo

**Sources:** [vintasoftware — Generating API clients in monorepos with FastAPI & Next.js](https://www.vintasoftware.com/blog/nextjs-fastapi-monorepo), [Abhay Ramesh — Achieving Full-Stack Type Safety with FastAPI, Next.js, and OpenAPI](https://abhayramesh.com/blog/type-safe-fullstack), [HN thread on Python backend + TS frontend type sharing](https://news.ycombinator.com/item?id=44464913), [FastAPI generate-clients docs](https://fastapi.tiangolo.com/advanced/generate-clients/).

### 5.1 The consensus pattern: OpenAPI is the contract, codegen is the bridge

Teams do **not** hand-share types or run Pydantic→TS converters (pydantic2ts-style tools exist but are now niche). The dominant 2025/2026 pattern:

1. **Pydantic models are the single source of truth.** FastAPI derives `openapi.json` from them automatically.
2. **Commit the schema artifact.** A backend command exports `openapi.json` into the repo (vintasoftware uses `python -m commands.generate_openapi_schema`); this file is the reviewable contract.
3. **Generate a TS client package from the artifact.** Hey-api (both articles use it) emits `types.gen.ts`, `schemas.gen.ts` (vintasoftware's layout), or sdk + query options.
4. **Frontend consumes it as a workspace package** (Abhay Ramesh's Turborepo + pnpm setup — directly matches instagram-tools):

```json
// apps/web/package.json
"dependencies": { "@acme/sdk": "workspace:*" }
```

```ts
input: process.env.OPENAPI_URL || "http://localhost:8000/openapi.json"
// pnpm gen  -> one-shot generation
// pnpm dev  -> watch mode, regenerates on spec change
```

So the Pydantic model flows automatically:

```python
class User(BaseModel):        # apps/api — write once
    id: int
    name: str
```
```ts
interface User { id: number; name: string }   // packages/api-client — generated, never edited
```

### 5.2 Keeping it in sync (drift prevention)

- **Dev loop:** vintasoftware runs a `watchdog` watcher on the Python side (re-export `openapi.json` + run `mypy` on change) and a `chokidar` watcher on the TS side (re-run codegen when `openapi.json` changes). Abhay Ramesh just points hey-api at the live `/openapi.json` URL in watch mode.
- **CI/commit:** a **pre-commit hook** regenerates schema + client and fails the commit if artifacts are stale (vintasoftware). The equivalent CI check is "regenerate and `git diff --exit-code`".

### 5.3 Where the generated package lives

Two placements seen in the wild:

- Inside the app: `apps/web/src/client/` (FastAPI docs default, vintasoftware's `app/openapi-client/`). Simple, fine for one frontend.
- **As a workspace package: `packages/api-client/`** (Abhay Ramesh; also the pattern in Vercel's next-forge-style Turborepo monorepos). Better when types may be reused (future mobile app, scripts, a worker) and keeps "generated, do-not-edit" code physically separate from app code. With pnpm + Turborepo already in place, this costs nothing.

---

## What instagram-tools should take from this

Current pain, with evidence paths:
- 7–8 fat client pages under `/Users/alijawad/Documents/instagram-tools/apps/web/src/app/(dashboard)/tools/{cover,export,hashtags,overview,profile,ranking,transcribe}` each doing inline `fetch` + `useState`.
- One flat 233-line `/Users/alijawad/Documents/instagram-tools/apps/web/src/lib/api.ts` plus stray `lib/export.ts`, `lib/hashtags.ts`.
- Backend already feature-shaped: `/Users/alijawad/Documents/instagram-tools/apps/api/tools/<name>/{router,schemas}.py` — the frontend should mirror it.

### Target shape

```
packages/
  api-client/                  # GENERATED by @hey-api/openapi-ts (+ TanStack Query plugin)
    openapi-ts.config.ts       #   input: apps/api openapi.json artifact
    src/                       #   types.gen.ts, sdk.gen.ts, @tanstack/react-query.gen.ts

apps/web/src/
  app/(dashboard)/tools/<tool>/page.tsx   # THIN: imports <ToolScreen> from features
  features/
    <tool>/                    # one per tool — mirrors apps/api/tools/<tool>/
      api/<tool>.queries.ts    #   query factory: wraps generated queryOptions, adds select/staleTime
      components/              #   tool-scoped UI
      hooks/                   #   tool-scoped hooks (only when they add logic)
      types.ts                 #   UI-only types (API types come from @repo/api-client)
      index.ts                 #   public surface
  components/                  # shared (shadcn ui/, ReelGrid, DownloadButton...)
  hooks/  lib/  config/        # shared only
```

### Concrete recommendations

1. **Adopt bulletproof-react's feature-module layout**: `src/features/<tool>/{api,components,hooks,types}`, all folders optional, `app/` pages reduced to thin routing shells. This is also Next.js docs "strategy 1" (project files outside `app`). One tool = one feature folder + one thin page + one registry entry — keeps tool #9 through #30 cheap.
2. **Enforce boundaries with ESLint** (`import/no-restricted-paths`): no cross-feature imports, `shared → features → app` only. Add it on day one — at 30 tools it's the only thing preventing a dependency hairball.
3. **Introduce TanStack Query with per-feature `queryOptions` factories** (TkDodo pattern), replacing inline fetch + useState. Use key hierarchies generic→specific for invalidation; distinct keys for infinite (cursor) vs normal queries.
4. **Generate the client with `@hey-api/openapi-ts` + its TanStack Query plugin** into a `packages/api-client` workspace package. It's FastAPI's officially recommended tool and emits exactly the `queryOptions`/`infiniteQueryOptions` style the maintainers endorse. Delete `lib/api.ts` once migrated.
5. **Prepare the FastAPI app for codegen**: tag every tool router, set `generate_unique_id_function` for clean operation IDs, add a `generate_openapi_schema` command that writes a committed `openapi.json`.
6. **Automate sync**: `pnpm gen` script + watch mode in dev; CI/pre-commit check that regenerates and fails on diff, so the contract can't drift.
7. **Keep `src/lib/tools.ts` as the registry**, but have each feature export its own registry entry (icon, route, title) from `features/<tool>/index.ts` so adding a tool touches only its feature folder + one import line.

---

## Sources

- bulletproof-react project structure: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- bulletproof-react Next.js sample: https://github.com/alan2207/bulletproof-react/tree/master/apps/nextjs-app/src
- TkDodo, Effective React Query Keys: https://tkdodo.eu/blog/effective-react-query-keys
- TkDodo, The Query Options API: https://tkdodo.eu/blog/the-query-options-api
- Next.js Project Structure docs (v16): https://nextjs.org/docs/app/getting-started/project-structure
- FastAPI, Generate Clients: https://fastapi.tiangolo.com/advanced/generate-clients/
- Hey API TanStack Query plugin: https://heyapi.dev/openapi-ts/plugins/tanstack-query
- OpenAPI codegen comparison (nyaomaru, DEV): https://dev.to/nyaomaru/which-openapi-codegen-should-you-choose-openapi-typescript-vs-hey-api-vs-orval-vs-kubb-100p
- Typesafe API codegen in 2026 (Sascha Becker): https://www.saschb2b.com/blog/typesafe-api-codegen-2026
- Vinta Software, FastAPI + Next.js monorepo client generation: https://www.vintasoftware.com/blog/nextjs-fastapi-monorepo
- Abhay Ramesh, Full-stack type safety with FastAPI + Next.js: https://abhayramesh.com/blog/type-safe-fullstack
- HN discussion, Python backend + TS frontend types: https://news.ycombinator.com/item?id=44464913
- Orval: https://orval.dev/
