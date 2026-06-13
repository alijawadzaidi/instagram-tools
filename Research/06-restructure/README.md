# Restructure Research — scalable folder structure

Goal: restructure the monorepo into the pattern a senior engineer would use —
feature modules, hooks, a query layer, a typed API client, shared packages —
so adding tools 9–30 stays cheap and nothing turns into spaghetti.

References studied:
- `binsr-inspect` (Amaan's production monorepo) — local at `~/Documents/binsr/binsr-inspect`
- `cal.com` — cloned at `Research/reference-repos/cal.com`
- Industry patterns (bulletproof-react, feature-sliced, TanStack Query conventions)

## Docs in this folder (read in order)
1. `01-current-web-audit.md` — what's wrong/right with `apps/web` today
2. `02-current-api-audit.md` — what's wrong/right with `apps/api` today
3. `03-binsr-conventions.md` — structural conventions from binsr-inspect
4. `04-calcom-conventions.md` — structural conventions from cal.com
5. `05-industry-patterns.md` — patterns from the wider ecosystem
6. `06-proposed-structure.md` — synthesis: the target structure (full trees,
   "adding tool #9" walkthrough, 18-row decisions table, 7-phase migration plan)

Final decision doc: `Architecture/04-scalable-structure-plan.md` (the short
version + open questions). Status: research complete, awaiting product-owner
answers to the open questions before Phase 0 starts.
