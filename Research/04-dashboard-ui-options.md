# Dashboard UI Options (researched + cloned)

Goal: a clean, good-looking, **shareable** dashboard shell that scales as we add
many tools. Not a SaaS app — no billing/multi-tenant needed. The key requirement
is a **registry-driven sidebar** so adding a tool is cheap, plus polish (dark mode,
command palette, responsive).

I cloned the real Next.js candidates into `reference-repos/` and read their code.

## Ruled out immediately
- **satnaing/shadcn-admin** (12k★, gorgeous) — it's **Vite + TanStack Router, NOT
  Next.js**. Using it would fight our entire monorepo/Next.js plan. ❌
- **ixartz/SaaS-Boilerplate**, next-saas-stripe-starter — heavy SaaS kits (auth,
  Stripe, i18n, multi-tenant). Massive overkill for a tool dashboard. ❌

## The three real options

### A) arhamkhnz/next-shadcn-admin-dashboard ("Studio Admin") — RECOMMENDED
- **Stack:** Next.js 16 (App Router), Tailwind v4, shadcn/ui, TypeScript, Zustand. MIT. 2.4k★, actively maintained.
- **Why it fits us best:** it already has the exact pattern we want — a single
  **typed sidebar registry** (`navigation/sidebar/sidebar-items.ts`) with groups,
  icons, and a built-in `comingSoon` flag. Adding a tool = add one entry + one route
  folder. **Colocation architecture** (each route owns its `_components/`) maps 1:1
  onto "each tool owns its UI."
- **Polish:** multiple theme presets, dark mode, collapsible sidebar, clean/minimal aesthetic.
- **What we'd do:** keep the shell + sidebar system, **delete the demo dashboards**
  (crm/finance/ecommerce/etc.), drop the auth layouts we don't need, add our tools.
- **Tradeoff:** comes with demo content to strip out (an hour of deleting).

### B) Kiranism/next-shadcn-dashboard-starter — most popular, heaviest
- **Stack:** Next.js 16, Tailwind v4, shadcn, TypeScript + React Query, Zustand, Zod, Recharts. MIT. 6.5k★.
- **Strengths:** the most battle-tested patterns (server-side data tables, parallel
  routes, React Query prefetch), **feature-based folders** (`src/features/*`) that
  also scale well per-tool.
- **Tradeoff:** **heavy & opinionated** — ships Clerk auth, billing/plans, kanban,
  chat, Sentry, notifications. We'd gut a lot. Great if we want batteries included
  and don't mind removing what we don't use.

### C) Build minimal from shadcn/ui official blocks
- Start from shadcn's official `sidebar` + `dashboard` blocks and assemble our own
  shell. **Zero bloat, total control,** always current with shadcn.
- **Tradeoff:** more upfront assembly; fewer niceties (theme presets, command
  palette) out of the box — we'd add them ourselves.

## Comparison at a glance
| | A) Studio Admin | B) Kiranism | C) Minimal blocks |
|---|---|---|---|
| Stack match (Next 16 + shadcn) | ✅ | ✅ | ✅ |
| Registry-driven sidebar | ✅ built-in | ✅ (config) | ➖ we build it |
| Bloat to remove | low–medium | **high** | none |
| Polish out of the box | high | high | low (DIY) |
| Time to our first tool | fast | medium (gut first) | medium (assemble) |
| Best when… | want clean + scalable now | want max patterns | want full control/min deps |

## ✅ DECISION: Option C — Build minimal from shadcn official blocks
The user chose **C**: assemble our own shell from shadcn's official `sidebar-07` +
`dashboard-01` blocks. Rationale: zero bloat, every line is ours, always current
with shadcn, nothing to strip. We build the tool registry + sidebar shell ourselves
(it's small) and add niceties (theme toggle, command palette) as needed. The
registry pattern from Option A's `sidebar-items.ts` is a good reference to mimic.

---

## (For reference) Original recommendation was Option A
**Option A (Studio Admin).** Its sidebar registry + colocation is already the
architecture we designed for "a collection of tools," it's clean and modern, and
adapting it is mostly *deletion*, not building. B is a fallback if we later want its
heavier data-table/query patterns; C if we decide to own every line.
