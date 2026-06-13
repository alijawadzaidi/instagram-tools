# cal.com — Structural Conventions Study

Source: `/Users/alijawad/Documents/instagram-tools/Research/reference-repos/cal.com` (read-only clone, studied 2026-06-13).
Purpose: extract patterns relevant to restructuring instagram-tools (8 tools today, 20-30 planned).

cal.com is the most relevant reference in this set because it has solved the exact problem instagram-tools is about to face: **a product that is a growing catalog of pluggable units** (151 apps in `packages/app-store`), with a shared dashboard shell, a typed API layer, and a feature-module architecture. It is also massively over-scaled for our needs, so the final section separates "copy this" from "admire from a distance."

---

## 1. Monorepo layout: `apps/` + `packages/`

Workspace globs from the root `package.json`:

```json
"workspaces": [
  "apps/*",
  "apps/api/*",
  "packages/*",
  "packages/embeds/*",
  "packages/features/*",
  "packages/app-store",
  "packages/app-store/*",
  "packages/platform/*",
  ...
]
```

Top-level layout:

```
cal.com/
├── apps/
│   ├── web/          # The Next.js dashboard app (thin — see §2.3)
│   ├── api/          # Public REST API (v1/v2)
│   └── docs/         # Documentation site
└── packages/
    ├── app-store/    # 151 self-contained "apps" (plugin registry) — §4
    ├── app-store-cli/ # Code generator: scaffolds apps + regenerates index files
    ├── features/     # Feature modules: domain logic + components per domain — §2
    ├── trpc/         # The entire typed API layer (routers + react client) — §3
    ├── ui/           # Design system: 49 dumb component folders — §5
    ├── lib/          # Shared utilities (183 entries — a dumping ground, see §5)
    ├── prisma/       # DB schema, client, zod-from-schema utils
    ├── types/        # Cross-package TS types (e.g. types/App, types/Calendar)
    ├── emails/       # Email templates
    ├── dayjs/        # Wrapped/configured dayjs instance (single source of date config)
    ├── i18n/         # Translations
    ├── config/, tsconfig/  # Shared lint + TS configs
    ├── kysely/, redis/...  # Infra adapters
    ├── embeds/       # Embeddable widget packages
    └── platform/     # "Atoms" — embeddable React SDK for enterprise customers
```

The governing principle: **`apps/web` contains almost no business logic.** It contains routes, page wrappers, and view modules; everything reusable lives in a `@calcom/*` package. Every package is importable as `@calcom/<name>` (e.g. `@calcom/features/bookings/lib/EventManager`, `@calcom/ui`, `@calcom/trpc/react`).

---

## 2. `packages/features` — the feature-module pattern

`packages/features` is a single workspace package (`@calcom/features`, see `packages/features/package.json`) containing ~70 domain folders: `bookings`, `eventtypes`, `auth`, `availability`, `calendars`, `flags`, `data-table`, `insights`, etc.

### 2.1 The per-feature folder contract

Each feature folder collocates everything for one domain. Representative feature #1 — **`bookings`** (the biggest domain):

```
packages/features/bookings/
├── components/            # Domain-specific React components
│   ├── event-meta/
│   ├── Header.tsx
│   ├── Section.tsx
│   └── TimeFormatToggle.tsx
├── hooks/                 # Domain-specific React hooks
│   ├── index.ts
│   ├── useBookerUrl.ts
│   ├── useBookingLocation.ts
│   └── useInitializeWeekStart.ts
├── lib/                   # Server + shared business logic (the bulk)
│   ├── handleNewBooking/      # one folder per big use-case, with test/ inside
│   ├── handleCancelBooking/
│   ├── handleSeats/{create,cancel,reschedule,lib,test}/
│   ├── conflictChecker/
│   ├── dto/                   # data-transfer types
│   ├── client/                # client-only logic, explicitly separated
│   └── interfaces/
├── repositories/          # DB access (BookingRepository etc.)
├── services/              # Orchestration services
├── di/                    # Dependency-injection containers
└── Booker/                # A whole sub-app (components/hooks/utils/__tests__)
```

Representative feature #2 — **`data-table`** (small, focused — closer to instagram-tools scale):

```
packages/features/data-table/
├── GUIDE.md                       # Usage doc lives WITH the feature
├── index.ts                       # Public barrel export
├── lib/
│   ├── types.ts
│   ├── utils.ts
│   ├── parsers.ts
│   ├── serializers.ts
│   ├── dateRange.ts + dateRange.test.ts
│   ├── server.ts                  # server-only entry kept separate
│   └── __tests__/
├── repositories/
│   ├── filterSegment.ts
│   └── filterSegment.type.ts
└── __tests__/filterSegments/{create,update,get,delete}.test.ts
```

Takeaways from the contract:
- **`components/ + hooks/ + lib/ + types` is the canonical inner shape.** Small features omit folders they don't need (data-table has no components/ at this level).
- **Tests live inside the feature**, next to the code (`*.test.ts` siblings or `__tests__/`).
- **Client and server code are explicitly separated** within `lib/` (`lib/client/`, `lib/server.ts`) so server builds never pull React code.
- A feature can ship its own `GUIDE.md`.

### 2.2 Page-level views live in `apps/web/modules`, not in features

cal.com splits "domain logic" (packages/features) from "page composition" (apps/web/modules). `apps/web/modules/bookings/`:

```
apps/web/modules/bookings/
├── views/          # bookings-view.tsx — the actual page body
├── components/     # 30+ page-specific components (BookingList, BookingDetailsSheet…)
├── hooks/          # useBookings.ts, useBookingStatusTab.ts, useVerifyCode.ts…
├── columns/        # table column defs
├── store/          # zustand-ish local stores
├── lib/
└── types.ts
```

Wired via tsconfig path alias (`apps/web/tsconfig.json`): `"~/*": ["modules/*"]`.

### 2.3 Pages are thin

`apps/web/app/(use-page-wrapper)/(main-nav)/bookings/[status]/page.tsx` is the entire route file: it parses params with zod, checks the session, fetches feature flags, then renders `BookingsList` imported as `~/bookings/views/bookings-view`. **The route file is glue; the view module is the page.** Route groups `(use-page-wrapper)` / `(booking-page-wrapper)` select the layout shell.

---

## 3. `packages/trpc` — the typed API layer

```
packages/trpc/
├── index.ts            # comment: "React exports moved to @calcom/trpc/react —
│                       #  separation improves build perf (server builds skip client code)"
├── server/
│   ├── procedures/     # authedProcedure, publicProcedure, pbacProcedures (authz tiers)
│   ├── middlewares/
│   ├── adapters/
│   └── routers/
│       └── viewer/     # one folder per domain, mirrors packages/features
│           ├── _router.tsx        # merges all domain routers
│           ├── bookings/
│           ├── eventTypes/
│           ├── availability/
│           └── ... (25 domains)
├── react/
│   ├── trpc.ts         # createTRPCNext client; RouterInputs/RouterOutputs types
│   ├── shared.ts       # ENDPOINTS const — split-link routes each top-level router
│   │                   # to its own lambda URL (deploy-size optimization)
│   └── hooks/          # tiny shared hooks: useMeQuery.ts, useEmailVerifyCheck.ts
└── components/
```

### 3.1 The router-folder convention (the most copyable idea)

Inside `packages/trpc/server/routers/viewer/bookings/`, **every procedure is a pair of files**:

```
addGuests.schema.ts      # zod input schema + inferred TS type (ZAddGuestsInputSchema)
addGuests.handler.ts     # the implementation, imports the schema type
confirm.schema.ts
confirm.handler.ts + confirm.handler.test.ts
get.schema.ts
get.handler.ts + get.handler.test.ts + get.handler.integration-test.ts
_router.tsx              # registers all procedures
util.ts                  # custom procedure (bookingsProcedure) w/ domain authz
```

`_router.tsx` imports all schemas eagerly but **lazy-imports each handler inside the procedure body**:

```ts
get: authedProcedure.input(ZGetInputSchema).query(async ({ input, ctx }) => {
  const { getHandler } = await import("./get.handler");
  return getHandler({ ctx, input });
}),
```

This keeps cold-start bundles small — only the schema graph loads upfront. Handlers call into `@calcom/features/*` repositories/services (e.g. `addGuests.handler.ts` imports `BookingRepository` from `@calcom/features/bookings/repositories/BookingRepository`) — **the trpc layer is thin transport + validation; logic lives in features.**

### 3.2 Type-safe consumption

Frontend components call the API with full inference and zero hand-written client code, e.g. `apps/web/modules/bookings/components/BookingListContainer.tsx:271`:

```ts
const query = trpc.viewer.bookings.get.useQuery(queryInput, { ... });
```

`packages/trpc/react/index.ts` exports `RouterInputs` / `RouterOutputs` so views can type props as `RouterOutputs["viewer"]["bookings"]["get"]["bookings"][number]` — **one source of truth for API types, inferred, never duplicated.**

Note: instagram-tools has a Python backend, so tRPC itself doesn't transfer — but the *shape* does: schema-per-endpoint, generated/typed client, React Query hooks namespaced by domain. (OpenAPI codegen + TanStack Query is the Python-backend equivalent.)

---

## 4. `packages/app-store` — the plugin/registry pattern (most relevant)

151 app folders + a handful of `_`-prefixed shared folders + **generated index files**:

```
packages/app-store/
├── _components/ _lib/ _pages/ _utils/      # shared machinery for all apps
├── _appRegistry.ts                          # runtime registry helpers
├── appStoreMetaData.ts                      # merges generated metadata
├── apps.metadata.generated.ts               # ← generated: all app configs
├── apps.server.generated.ts                 # ← generated: map slug → lazy api import
├── apps.browser.generated.tsx               # ← generated: map slug → next/dynamic component
├── apps.schemas.generated.ts                # ← generated: per-app zod schemas
├── apps.keys-schemas.generated.ts           # ← generated: per-app credential schemas
├── giphy/ zoomvideo/ stripepayment/ ...     # one folder per app
└── templates/                               # starter templates the CLI copies
```

### 4.1 Per-app folder contract

Two real examples:

```
packages/app-store/zoomvideo/          packages/app-store/giphy/
├── _metadata.ts   # name/slug/logo…   ├── _metadata.ts        (or config.json)
├── index.ts       # barrel export     ├── index.ts
├── zod.ts         # app settings      ├── zod.ts
├── package.json                       ├── package.json
├── DESCRIPTION.md                     ├── DESCRIPTION.md
├── static/icon.svg + screenshots      ├── static/icon.svg + screenshots
├── api/           # add.ts,           ├── api/get.ts, search.ts, add.ts
│   #  callback.ts (oauth), index.ts   ├── components/   # UI the app injects
└── lib/VideoApiAdapter.ts,            │     EventTypeAppCardInterface.tsx …
      getZoomAppKeys.ts                └── lib/giphyManager.ts
```

The contract every app satisfies: **`_metadata.ts`/`config.json` (declarative manifest) + `index.ts` (barrel) + optional `api/`, `lib/`, `components/`, `static/`, `zod.ts`.** Newer apps use pure-JSON `config.json` (see `packages/app-store/fathom/config.json` — slug, categories, logo, `extendsFeature: "EventType"`, even declarative script-injection `appData.tag.scripts`). The metadata is data, not code, wherever possible.

### 4.2 Registration is generated, not manual

`packages/app-store-cli` (`src/build.ts`) walks the app-store directory, reads each `config.json`/`_metadata.ts`, and **regenerates the index files** (`yarn app-store:build --watch`). Each generated file is headed with "autogenerated… don't modify manually." Two key outputs:

- `apps.server.generated.ts` — `export const apiHandlers = { giphy: import("./giphy/api"), zoomvideo: import("./zoomvideo/api"), ... }` → a single catch-all Next.js route dispatches `/api/integrations/[app]/[endpoint]` through this map. **Adding an app adds zero routes.**
- `apps.browser.generated.tsx` — `EventTypeAddonMap = { giphy: dynamic(() => import("./giphy/components/EventTypeAppCardInterface")), ... }` → host pages render app UI by slug, code-split via `next/dynamic`.

The CLI also scaffolds: `yarn create-app` is an interactive generator (`src/commandViews/Create.tsx`) that copies from `templates/` and asks for metadata. **"Add an app" = run generator, fill in the folder, indexes regenerate.** This is exactly the property instagram-tools wants for "adding a tool is cheap."

The pattern that matters: **apps never edit central files.** The registry (`src/lib/tools.ts` in instagram-tools terms) is *derived from* the per-app folders, not maintained by hand.

---

## 5. `packages/ui` and `packages/lib`

### `packages/ui` — design system, strictly dumb

```
packages/ui/
├── classNames.ts
├── styles/
└── components/        # 49 folders: button/ badge/ dialog/ dropdown/ form/
                       #   empty-screen/ skeleton/ table/ toast/ tooltip/ ...
```

Each component folder is self-contained (component + index barrel + often tests/stories). Rule observable from imports: **`ui` never imports from `features` or `trpc`** — it is pure presentation. Domain components (in `features/*/components` or `modules/*/components`) compose `@calcom/ui` primitives. instagram-tools' equivalent is its shadcn `components/ui` — the lesson is the directionality rule, not the package split.

### `packages/lib` — cautionary tale

183 top-level entries (`packages/lib/`): `array.ts`, `crypto.ts`, `CalendarService.ts`, `CloseCom.ts`, `getAdditionalEmailHeaders.ts`… It's a flat junk drawer that grew for years; cal.com is visibly migrating things *out* of it into `features/*/repositories` (see alias `"@calcom/repository/*": ["@calcom/lib/server/repository/*"]` in `apps/web/tsconfig.json` — a compatibility shim for an in-flight migration). **Lesson: an unstructured shared `lib` becomes the place code goes to hide. Keep shared utils tiny; put domain code in the domain folder from day one.**

---

## 6. Honest assessment: right-sized vs. overkill for an 8-30 tool product

### Right-sized — adopt the pattern

| cal.com pattern | Why it fits instagram-tools |
|---|---|
| **Per-tool folder contract** (`_metadata` + `index.ts` + `api/` `lib/` `components/`) | Directly replaces "fat page component" — each of the 8 tools becomes a folder with the same shape. This is the #1 takeaway. |
| **Registry derived from tool folders** (even if hand-rolled `index.ts` re-exporting each tool's `meta`, no codegen yet) | `src/lib/tools.ts` keeps working but stops being a parallel source of truth. |
| **schema + handler file-pair per endpoint** | Maps 1:1 onto FastAPI: instagram-tools already has `tools/<name>/{router,schemas}.py` — cal.com validates this is the right backend shape; mirror it on the frontend. |
| **Typed API layer with namespaced query hooks** (`trpc.viewer.bookings.get.useQuery`) | The equivalent: typed client generated from FastAPI's OpenAPI + TanStack Query hooks per tool (`useProfileOverview()`), replacing inline fetch + useState. |
| **Thin route files → view modules** (`page.tsx` ≈ 30 lines, body in `modules/<x>/views`) | Kills the 8 fat client components; pages become metadata + a view import. |
| **components/hooks/lib/types inner shape**, tests collocated, client/server split inside `lib/` | Cheap discipline that scales from feature #1. |
| **`dayjs`-style "configured dependency" wrapper** | Same idea for instagram-tools' transcription engine and future LLM client: one package/module that owns config, swappable behind it. |

### Overkill at 8-30 tools — skip or defer

| cal.com pattern | Why to skip |
|---|---|
| **Generated index files + app-store-cli codegen** | Worth it at 151 apps. At 8-30, a hand-maintained barrel `tools/index.ts` (one import line per tool) is fine; revisit codegen at ~25+ tools. A simple `plop`/script scaffold is the 20% that gives 80%. |
| **Splitting features into a separate workspace package** (`packages/features`) | cal.com needs it because 3 apps + embeds + platform SDK consume features. instagram-tools has one web app — `apps/web/src/features/<tool>/` (or `modules/`) inside the app is enough. Extract to `packages/` only when a second consumer appears. |
| **tRPC split-link per-lambda `ENDPOINTS` routing**, lazy handler imports | Deploy-size optimization for a giant router; irrelevant with a FastAPI backend. |
| **DI containers (`di/`), repositories + services layering everywhere** | Enterprise testing/team-scale machinery. For instagram-tools: plain functions in `tools/<name>/service.py` until pain appears. |
| **`packages/lib` with 183 files** | Anti-pattern to actively avoid, not adopt. |
| **`packages/platform` (atoms SDK), `embeds/`, i18n, emails, multiple apps** | Product-driven; no analog needed. |
| **Per-app `package.json` for every app-store app** | Yarn-workspace granularity that buys cal.com install isolation; unnecessary below ~50 plugins. |

---

## What instagram-tools should take from this

1. **Make each tool a self-contained folder with a fixed contract** — `apps/web/src/features/<tool>/{meta.ts, components/, hooks/, api.ts (or queries.ts), types.ts}` mirroring the backend's `apps/api/tools/<name>/{router,schemas}.py`. The cal.com app-store proves a uniform per-unit contract is what makes "adding a unit" cheap (151 times over).
2. **Derive the tool registry from the tool folders.** `src/lib/tools.ts` should become `features/index.ts` that imports each tool's `meta.ts` (icon, slug, title, category) — one source of truth driving sidebar, home grid, and routes. Skip cal.com's codegen for now; add a scaffold script (`pnpm new-tool`) as the lightweight version of `yarn create-app`.
3. **Replace inline fetch + useState with a typed query layer.** cal.com's `trpc.viewer.bookings.get.useQuery` ergonomics are reachable with a Python backend via OpenAPI-generated client + per-tool TanStack Query hooks (`features/<tool>/queries.ts`). Type duplication between `lib/api.ts` and Pydantic schemas disappears.
4. **Make route files thin.** Each `app/(dashboard)/tools/<slug>/page.tsx` becomes ~15 lines: metadata + render `<ToolView/>` from the feature folder (cal.com's `page.tsx → ~/bookings/views/bookings-view` pattern).
5. **Enforce import directionality:** `components/ui` (shadcn) imports nothing domain-specific; features import ui + the query layer; pages import features. cal.com's `ui` package never touches `features`/`trpc`.
6. **Keep shared `lib/` tiny and domain code in domains.** cal.com's 183-file `packages/lib` and its in-flight migration out of it (`@calcom/repository/*` alias shim) is the cost of not doing this.
7. **Adopt the schema/handler file-pair on the backend too:** for tools with multiple endpoints, `tools/<name>/` grows `handlers/<endpoint>.py` next to schemas rather than one fat router file — same shape as `addGuests.schema.ts`/`addGuests.handler.ts`.
8. **Wrap swappable engines as configured-dependency modules** (like `packages/dayjs`): one module owns the transcription engine and, soon, the LLM client (model choice, retries, cost logging) — tools import the wrapper, never the vendor SDK.
