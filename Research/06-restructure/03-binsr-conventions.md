# binsr-inspect Conventions — Structural Reference for instagram-tools

Source studied: `/Users/alijawad/Documents/binsr/binsr-inspect` (read-only).
This is the user's production SaaS (inspection/reporting platform): Next.js 15 admin app + Expo mobile app + Node PDF server, sharing logic through 10 workspace packages. It is several years more mature than instagram-tools and shows both the patterns worth copying and the scars worth avoiding.

---

## 1. Workspace Layout

```
binsr-inspect/
├── apps/
│   ├── web/        → Admin app: Next.js 15 App Router (also shipped via Capacitor to iOS/Android)
│   ├── mobile/     → Report Builder: Expo 54 + Expo Router
│   └── server/     → Node service: PDF generation, AI prompts, frame analysis (Fly.io)
├── packages/
│   ├── types/             → ALL shared TS types: models/, api/, ui/, services/, utils/, subscriptions/
│   ├── firebase-services/ → Platform-agnostic data layer (adapters + services + apiClient)
│   ├── hooks/             → Shared React hooks w/ platform adapter injection (HooksProvider)
│   ├── providers/         → Zustand stores + context providers + adapter *interfaces*
│   ├── rbac/              → Role/permission logic
│   ├── ui/                → Shared UI primitives (src/{hooks,utils})
│   ├── ui-config/         → Design tokens / Tailwind config
│   ├── utils/             → Pure utilities (built with tsdown)
│   ├── typescript-config/ → Shared tsconfig bases
│   └── auth/              → EMPTY (placeholder dir containing only .turbo — a smell, see §7)
├── turbo.json              → tasks: build, lint, test, dev, type-check, quick-check, clean
├── pnpm-workspace.yaml     → apps/* + packages/*
└── package.json            → filtered dev scripts: dev:web / dev:mobile / dev:server
```

Evidence: `binsr-inspect/package.json` (workspaces, `dev:web": "turbo run dev --filter=@binsr-inspect/web..."`), `turbo.json`, `pnpm-workspace.yaml`, `CLAUDE.md` ("Monorepo Structure").

Key root-level conventions:

- **Filtered dev scripts per app** — `pnpm dev:web` runs the web app *plus its package dependencies* via Turbo's `--filter=@binsr-inspect/web...` syntax.
- **`quick-check` Turbo task** — a fast type-check across all packages; their CLAUDE.md says "Always use this, never raw `tsc`".
- **Package naming**: shared packages use the `@repo/*` scope (`@repo/types`, `@repo/hooks`, `@repo/firebase-services`), apps use `@binsr-inspect/*`.
- Husky + lint-staged + secretlint at root; prettier formatting script; `clean:fresh` nuclear-reset script.
- `turbo.json` declares every secret in `globalEnv` (~45 entries) so Turbo cache keys account for env changes.

---

## 2. `packages/hooks` In Depth — The Adapter/Provider Pattern

This is the most instructive package. It lets **one hook implementation serve both web and mobile** by injecting platform capabilities through a context-provided adapter.

```
packages/hooks/src/
├── HooksProvider.tsx        → React context carrying a HooksAdapter; useHooksAdapter() accessor
├── index.ts                 → curated barrel: provider, adapters, hooks, services, toast, license-utils
├── capacitor.ts             → Capacitor-specific entry (own export subpath)
├── types/index.ts           → THE CONTRACT: HooksAdapter interface + per-domain adapter interfaces
├── adapters/
│   ├── index.ts             → exports createWebAdapter, createNativeAdapter
│   ├── web.ts               → web impl (localStorage, react-toastify, file inputs, window.history)
│   └── native.ts            → RN impl (AsyncStorage, toast-message, expo camera, RN navigation)
├── hooks/                   → ~40 shared hooks (useServices, useSubscription, useJobPolling,
│   │                          useMultipleJobsPolling, useLocalStorage, useOfflineInspections,
│   │                          useInspectionCache, useRealtimeSync, useCollaboration, …)
│   └── index.ts
├── services/
│   ├── index.ts
│   └── ai-writer.ts         → typed fetch wrapper for the AI endpoint (writeWithAI())
├── utils/                   → toast.ts, searchFilters.ts, license-utils.ts
└── __tests__/               → vitest tests + helpers/test-factories.ts
```

### The layering, bottom-up

1. **`types/index.ts` defines the adapter contract** (`packages/hooks/src/types/index.ts`). `HooksAdapter` is an interface of platform capabilities: `storage`, `sessionStorage`, `navigation`, `platform` (isWeb/isNative/isIOS/isAndroid), `toast`, `media`, `keyboard` — plus **optional domain adapters** (`commentCatalogue?`, `inspections?`) for data operations a hook needs but whose implementation differs per app.

2. **`HooksProvider.tsx` is tiny** (25 lines): a context + a `useHooksAdapter()` accessor that throws if used outside the provider. The whole cross-platform trick is just constructor injection via React context:

```tsx
// packages/hooks/src/HooksProvider.tsx
export function HooksProvider({ adapter, children }: HooksProviderProps) {
  return <HooksContext.Provider value={adapter}>{children}</HooksContext.Provider>;
}
export function useHooksAdapter(): HooksAdapter { /* useContext + throw */ }
```

3. **`adapters/web.ts` / `adapters/native.ts`** implement the contract. The web one wraps `window.localStorage`, dynamically imports `react-toastify` (declared as an *optional peerDependency* so mobile never installs it), creates `<input type="file">` for media picking, etc.

4. **Hooks call `useHooksAdapter()` for platform stuff and `@repo/firebase-services` for data.** E.g. `useLocalStorage`, `useQuickAddData`, `useCommentCatalogue` consume the adapter; `useServices` calls `getServicesByAccountID()` from the services package directly.

5. **Each app wires it once at the root.** Web: `apps/web/src/providers/HooksProviderWrapper.tsx` — a client component that initializes Firebase config, builds the web adapter with `createWebAdapter()` from `@repo/hooks/adapters`, and renders `<HooksProvider adapter={...}>`.

### Hook return-shape convention

Every data hook returns the same envelope — this is their de-facto "query layer" convention:

```ts
// packages/hooks/src/hooks/useServices.ts
interface UseServicesResult {
  services: Service[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
export function useServices(accountID: string): UseServicesResult { ... }
```

Internally it is `useState` + `useEffect` + `useCallback(fetch)` — **not TanStack Query** (see §5). Cross-component cache invalidation is hand-rolled: `useServices` keeps a module-level `Set<RefreshListener>` and exports `triggerServicesCacheRefresh()` so a cache manager elsewhere can force refetches. This works but is exactly the machinery a query library provides for free.

### Package manifest conventions

`packages/hooks/package.json`:
- Ships **raw TS source** (`"main": "./src/index.ts"`, no build step) — consumers compile it. Simple, fast iteration; works because all consumers are bundled apps.
- **Subpath exports** for heavy/optional modules: `"./adapters"`, `"./capacitor"`, and per-hook subpaths (`"./useCollaboration"`, `"./usePresence"`, `"./useRealtimeSync"`) so importing one hook doesn't drag in realtime deps.
- Platform UI deps (`react-toastify`, `react-native-toast-message`) are **optional peerDependencies** — the package never owns platform packages.

---

## 3. `apps/web/src` Layering — What Lives Where

```
apps/web/src/
├── app/            → routes only (pages + 322 API route handlers under app/api/*)
├── components/     → ~70 DOMAIN folders (crm/, calendar/, booking/, inspection-page/,
│                     data-table/, dialogs/, layout/, common/, …), not type-of-file folders
├── hooks/          → web-only hooks (useDebounce, useProAccess, use-subscription, …)
│   └── team/       → domain hook module: useTeamMembers, useRoles, usePermissionEditor,
│                     __tests__/, index.ts barrel  ← per-domain hook folders once a domain grows
├── context/        → web-only React contexts (NavigationContext, UnsavedChangesContext, …)
├── providers/      → app-root wiring (HooksProviderWrapper.tsx — adapts shared packages to this app)
├── adapters/       → implementations of interfaces DECLARED in packages
│   ├── WebNavigationAdapter.ts   → implements NavigationAdapter from @repo/providers
│   └── WebPostHogAdapter.ts
├── lib/            → server-ish business logic, grouped by domain folder:
│   ├── subscriptions/  → entitlement-service.ts, pricing-calculator.ts, stripe-sync.ts, …
│   ├── inspection/     → duplicate-inspection.ts, patch-comment.ts, …
│   ├── auth/ email/ payment/ rbac/ reports/ templates/ team/ …  (+ loose .ts files — see §7)
├── firebase/       → firebase app glue
├── constants/      → constants
├── i18n/           → next-intl setup
├── types/          → ONLY ambient .d.ts (appcues.d.ts, capacitor.d.ts) — real types live in @repo/types
└── middleware.ts, instrumentation.ts
```

The important splits:

- **`components/` is organized by domain, not by component type.** `components/crm/`, `components/calendar/`, `components/inspection-page/components/AppBar.tsx`. Reusable cross-domain pieces sit in `components/common/`, `components/layout/`, `components/data-table/`.
- **`hooks/` graduates from flat files to domain folders** — `hooks/team/` has its own barrel, tests, and 6 hooks. That's the growth path: flat until a domain needs >2-3 hooks, then a folder.
- **`adapters/` is the dependency-inversion seam**: shared packages declare interfaces (`packages/providers/src/adapters/navigation-adapter.interface.ts`, `analytics-adapter.interface.ts`), the app implements them (`apps/web/src/adapters/WebNavigationAdapter.ts`). Packages never import app code.
- **`providers/` holds only composition glue** (one file: `HooksProviderWrapper.tsx`). Reusable providers live in `packages/providers/src/{auth,cache,diff,posthog,subscription-status,unsaved-changes}/`.
- **`app/` stays thin** — pages and route handlers; logic is in `lib/` or packages.
- **`src/types/` is nearly empty by design** — shared types were pushed to `@repo/types`, leaving only ambient declarations.

The backend is mostly **Next.js route handlers** (`apps/web/src/app/api/**` — 322 `route.ts` files, grouped by domain: `api/inspections/`, `api/subscriptions/`, `api/ai-writer/`, …), with `apps/server` reserved for heavy work (PDF rendering with a browser pool, AI frame analysis, prompts in `apps/server/src/prompts/*.prompt.ts`).

---

## 4. The Data Layer — Where API Calls Live

Three tiers, all in `packages/firebase-services`:

```
packages/firebase-services/src/
├── core/firebase-factory.{web,native}.ts  → picks the right adapter per platform
├── adapters/
│   ├── web.ts        → createWebAdapter(): FirebaseAdapter (firebase JS SDK)
│   ├── native.ts     → createNativeAdapter(): FirebaseAdapter (@react-native-firebase)
│   └── supabase.ts   → SupabaseAdapter implements FirebaseAdapter (DB swap behind same interface!)
├── services/         → DOMAIN service modules: account.ts, auth.ts, calendar.ts, service.ts,
│                       template.ts, user.ts, pricing.ts, ai/, agreement/ …
├── supabase/shared/api-client.ts  → typed HTTP client (apiClient)
├── config.ts, db.ts, index.ts (+ index.native.ts platform entries)
└── types/, utils/
```

1. **Adapter tier** — `FirebaseAdapter` is one interface with `getDoc/getDocs/setDoc/query/where/...`; implemented three times (web Firebase, RN Firebase, Supabase). `SupabaseAdapter → FirebaseAdapter` let them migrate databases without touching services. (CodeGraph: `SupabaseAdapter implements FirebaseAdapter`.)

2. **Service tier** — flat functions per domain with rigid CRUD naming, e.g. `packages/firebase-services/src/services/service.ts`:
   `getServicesByAccountID`, `getServiceById`, `createService`, `updateService`, `deleteService`, `getServiceDocuments`, … The naming convention is `get<Entity>By<Key>` / `create<Entity>` / `update<Entity>` / `delete<Entity>`.

3. **HTTP client tier** — `packages/firebase-services/src/supabase/shared/api-client.ts` exports `apiClient` with:
   - a typed envelope: `ApiResponse<T> = { success, data?, error?, code?, status?, retryable?, details? }`
   - automatic Firebase auth token injection
   - retry with exponential backoff + jitter (`getBackoffDelay`), `isNetworkError()` classification, per-call `maxRetries`/`skipRetry`
   - a pluggable **offline interceptor** (`registerSupabaseOfflineInterceptor`) used by mobile to queue mutations.

   Their CLAUDE.md hard rule: *"never raw `fetch()` — use `InspectionAPI` or `apiClient`; both handle auth tokens, 401 retry, and token refresh automatically."*

### Is TanStack Query used?

**No, and that's a finding in both directions.**
- `apps/web` has no `@tanstack/react-query` (only `@tanstack/react-virtual`); zero `useQuery` usage in `apps/web/src` or `packages/hooks`.
- `apps/mobile/package.json` lists `@tanstack/react-query: ^5.76.1` but no `useQuery`/`QueryClientProvider` usage was found in `apps/mobile/{app,components,hooks,lib}` — a **dead dependency**.
- The cost of not using it is visible: hand-rolled refresh-listener registries (`triggerServicesCacheRefresh` in `useServices.ts`), a `useCacheManager` hook, `useInspectionCache`, `useCalendarCache` — hundreds of lines reimplementing staleness, invalidation, and polling (`useJobPolling`, `useMultipleJobsPolling`).

Verdict for instagram-tools: copy their **hook envelope + service function + typed client** layering, but put TanStack Query in the middle instead of hand-rolled `useState`/listener machinery. They earned that scar; you don't have to.

---

## 5. How Shared Types Flow

`packages/types` is the single source of truth, internally organized by *kind*:

```
packages/types/src/
├── models/         → domain entities (inspection.ts, template.ts, user.ts, crm-client.ts, … 37 files)
├── api/            → request/response & API-shape types (payment-response.ts, filter-state.ts, …)
├── services/       → service-level contracts (ai-writer.ts, pricing.ts, automation-v2/, …)
├── ui/             → UI-only shapes (booking-form-data.ts, table-preferences.ts, …)
├── utils/          → type-adjacent pure helpers (filters.ts, status.ts, phone.ts, …)
├── subscriptions/, announcements/
└── index.ts        → `export * from` each category
```

Mechanics worth copying (`packages/types/package.json`):
- Built with **tsdown** to `dist/*.mjs` + `.d.mts`; per-category **subpath exports** (`@repo/types/models`, `@repo/types/api`, …) so consumers can import narrowly.
- A `"react-native"` export condition points Metro at raw `src/` while web gets built `dist/` — one package, two consumption modes.
- Types package may depend on other type-ish packages (`@repo/rbac`) but never on app code.

Flow in practice: `@repo/types` → consumed by `@repo/firebase-services` (service signatures), `@repo/hooks` (hook results), `apps/web`, `apps/mobile`, `apps/server`. Example chain: `Service` model → `getServicesByAccountID(): Promise<Service[]>` → `useServices(): { services: Service[] }` → component.

Their CLAUDE.md also ties **vocabulary** to types: a canonical-terminology glossary ("Client not customer, Inspector not user, …") with "When in doubt, check `packages/types/src/models/` — the type name is the canonical term." Types as the naming authority is a cheap, powerful convention.

---

## 6. Codified Engineering Principles (their CLAUDE.md)

Worth stealing nearly verbatim:

1. **Unification** — one representation per concept; differentiate with metadata, never with parallel fields/code paths.
2. **No default-vs-custom split** — one array, `{ source: "default" | "custom" }` on the item.
3. **Always arrays** — never `type: string` + `types: string[]` pairs.
4. **Logic lives in shared packages** — "If you write logic in `apps/web/` that the mobile app also needs, move it to a shared package." Explicit map: types→`packages/types`, stores→`packages/providers`, data→`packages/firebase-services`, hooks→`packages/hooks`.
5. **Canonical terminology table** + instruction to flag drift during edits.
6. **Reuse-existing-components tables** — CLAUDE.md lists key reusable components with file paths (`DataTable` at `data-table/DataTable.tsx`, `CommonPageContainer` at `layout/CommonPageContainer.tsx`) so agents/devs find them.

---

## 7. What Clearly Hurt Them — Anti-Patterns to AVOID

Real evidence, real paths:

1. **Junk accumulating at repo root**: `march5debug.json`, `calender_logs.csv`, `calender_logs.json` (typo'd, twice), `importer_logs.json`, `importer_new_logs.json`, `binsr-inspect-log-export-2026-03-05T15-40-10.json`, `Untitled/`, `tmp/`, `work/`, `test/`, `notion-responses/`, `STRIPE_MIGRATION_SCHEMA.sql`, `supabase-migration-scripts.sql`. Debug exports and scratch dirs were committed and never cleaned. → instagram-tools: keep a gitignored `scratch/`, and put one-off SQL/data in dated folders under `docs/` or delete it.

2. **Empty placeholder package**: `packages/auth/` contains only `.turbo/` — declared in the layout, never built. Dead structure misleads every newcomer (and every LLM). Don't scaffold packages before they have content.

3. **`-v2` parallel versions left in tree**: `components/booking-form/` AND `components/booking-form-v2/`, `photo-editor/` AND `photo-editor-v2/`, `pdf-html/components/cover-v2.ts`, `florida-wind-mit-v2.ts` + `transformer-wind-mit-v2.0.ts`, `types/src/ui/photo-editor-v2.ts`. Rewrites never finished their migrations. → Finish migrations and delete v1, or feature-flag inside one module.

4. **Hardcoded secrets/config fallbacks in source**: `packages/firebase-services/src/adapters/web.ts:32-37` falls back to a real Firebase API key, project id, and app id when env vars are missing. They later bolted on `secretlint` at root — the scar tissue is visible. Fail loudly on missing env instead.

5. **322 ad-hoc API route handlers**, including `app/api/test/`, `app/api/debug-env/`, `app/api/sentry-example-api/` left in production code. Routes grew without a manifest/registry; debug endpoints shipped. → instagram-tools' FastAPI `tools/<name>/router.py` registry approach is already better; keep it.

6. **Giant flat barrel in `firebase-services/src/index.ts`** — hundreds of re-exports in one file (auth, accounts, team, calendar…). Every import pulls the whole graph into the module map and the file is a merge-conflict magnet. They partially recovered with per-service subpath exports (`"./services/account"`); start with per-domain subpaths from day one.

7. **Hand-rolled query caching** (covered in §4): module-level listener `Set`s, `useCacheManager`, bespoke polling hooks — plus an unused `@tanstack/react-query` dep on mobile. Adopt a query library before writing the first cache.

8. **`apps/web/src/lib/` sprawl**: ~60 entries mixing domain folders (`subscriptions/`, `inspection/`) with loose one-off files (`notion.ts`, `posthog-pql.ts`, `pql-digest-queries.ts`, `pql-notion-sync.ts`, `clone-template-photos.ts`, `utils.ts` next to `utils/`). The folder convention was right; discipline lapsed. Enforce "every lib file lives in a domain folder."

9. **`any`-typed adapter internals & console.log noise**: `let toast: any`, `firebaseDb: any` in adapters; `console.log` scattered through shared hooks (`[useServices] Refreshed services: …`). Use a leveled logger util from the start.

10. **Inconsistent package build strategy**: `@repo/types`/`@repo/utils` built with tsdown, `@repo/hooks`/`@repo/firebase-services`/`@repo/ui` ship raw TS. Workable, but each new package re-decides. Pick one default (raw-source for app-only consumption is fine) and document it.

---

## What instagram-tools should take from this

### Adopt directly

1. **Packages-by-responsibility, apps-stay-thin.** Create `packages/types` (with `models/`, `api/` subfolders + subpath exports from day one), `packages/api-client` (the typed fetch layer), and keep `apps/web` to routes + components + feature wiring. binsr's rule "if logic could be shared, it lives in a package" is what keeps tool #23 cheap.

2. **A typed API client with an envelope, not raw fetch.** Port the `apiClient` ideas from `packages/firebase-services/src/supabase/shared/api-client.ts`: `ApiResponse<T> { success, data?, error?, code?, status?, retryable? }`, central base-URL resolution, retry/backoff with jitter, network-error classification. Make "never raw fetch in a component" a written rule like their CLAUDE.md does. This replaces the flat 233-line `lib/api.ts`.

3. **Service-module naming convention.** One module per tool/domain exporting flat functions named `get<X>By<Y>` / `create<X>` / etc. (their `services/service.ts` pattern). For instagram-tools: `features/<tool>/api.ts` exporting `transcribeReel()`, `getProfileReels(cursor)` — typed against `packages/types`.

4. **The standard hook envelope — but powered by TanStack Query.** Standardize every tool's data hook on `{ data, isLoading, error, refresh }` like `useServices`, but implement with `useQuery`/`useMutation` + query-key factory per tool. binsr hand-rolled invalidation registries and polling hooks (`useJobPolling`, `useCacheManager`) because they skipped a query library — that's the single most expensive omission to learn from, and instagram-tools' transcription jobs need polling on day one.

5. **Domain/feature folders that graduate.** Components and hooks grouped by feature (`components/crm/`, `hooks/team/{index.ts,useTeamMembers.ts,__tests__/}`), flat only while small. For instagram-tools: `features/<tool>/{components,hooks,api.ts,types.ts}` mirrors the FastAPI `tools/<name>/{router,schemas}.py` — same name on both sides.

6. **Types as the naming authority + glossary.** `@repo/types` with category subfolders, `export *` index plus narrow subpaths, and a CLAUDE.md terminology table ("Reel not video, Profile not account…"). Mirror Pydantic schema names in `packages/types` 1:1.

7. **Root ergonomics**: `dev:web`/`dev:api` filtered Turbo scripts, a `quick-check` type-check task, secretlint/gitleaks in pre-commit *from the start* (they added it after hardcoding Firebase keys), and `turbo.json` `globalEnv` listing every secret.

8. **Adapter interfaces for swappable engines.** Their `FirebaseAdapter` interface with `SupabaseAdapter implements FirebaseAdapter` is exactly the shape for instagram-tools' swappable transcription engine and future scraping backends: define `TranscriptionEngine`/`IgFetcher` interfaces in shared code, implement per provider, select in a factory (`core/firebase-factory.web.ts` pattern). The `HooksProvider` constructor-injection pattern is the React-side version if a mobile app ever appears — until then, the interface-in-package/implementation-at-edge idea is the part to keep.

### Explicitly avoid

9. **No scratch in tree**: no debug JSON dumps, `Untitled/`, `tmp/`, `-v2` parallel components, empty placeholder packages, or `/api/test` + `/api/debug-env` endpoints. Gitignore a `scratch/` dir; delete v1 when v2 ships.

10. **No mega-barrel**: give every package per-domain subpath exports immediately (`@repo/types/models`, `@repo/api-client/<tool>` if needed) instead of one giant `index.ts`; and don't add dependencies (their unused mobile react-query) "for later."
