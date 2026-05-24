# Monorepo Layout — built to scale to many tools

The real app lives at the **repo root** as a polyglot monorepo. The planning
folders (`Research/`, `Architecture/`, `Implementation/phase0-spike/`) sit
alongside it and are not part of the shipped app.

## Root layout

```
instagram-tools/                  # repo root = the monorepo
├── apps/
│   ├── web/                      # Next.js — the toolset UI (Vercel)
│   │   └── app/
│   │       ├── page.tsx          # home: lists all tools (from a registry)
│   │       ├── tools/
│   │       │   └── transcribe/   # tool #1 page
│   │       └── lib/api.ts        # one typed client to the backend
│   └── api/                      # Python FastAPI — does the real work (container/VM)
│       ├── main.py               # mounts every tool's router
│       ├── shared/               # REUSED by every tool
│       │   ├── downloader.py     # yt-dlp + cookies + error classification
│       │   ├── audio.py          # ffmpeg helpers
│       │   ├── jobs.py           # background job + polling plumbing
│       │   └── errors.py         # typed errors (private/blocked/no-audio…)
│       └── tools/
│           └── transcribe/       # tool #1 backend
│               ├── router.py     # POST /tools/transcribe, GET .../{job_id}
│               ├── service.py    # orchestrates the 3 stages
│               └── engines/      # local_whisper | openai | assemblyai
├── packages/                     # shared FRONTEND code (optional, as web grows)
│   └── ui/                       # shared React components / design system
├── Research/  Architecture/  Implementation/   # planning + phase-0 (not shipped)
├── package.json                  # pnpm workspaces / Turborepo (JS side)
├── pnpm-workspace.yaml
└── README.md
```

## How adding a new tool works (the scaling story)

Adding **tool #2** (say, a hashtag generator) touches three predictable places —
no architectural changes:

1. **Backend:** create `apps/api/tools/<tool>/` with a `router.py`; reuse anything
   in `shared/` (the downloader, audio, jobs). Mount it in `main.py`. One line.
2. **Frontend:** add `apps/web/app/tools/<tool>/page.tsx` and one entry in the tool
   **registry** so it shows up on the home page automatically.
3. **Contract:** the typed `lib/api.ts` client gets one new method.

The whole point: **the expensive, fragile bits (downloading, cookies, ffmpeg,
job handling) are written once in `shared/` and every tool reuses them.**

## Tooling choices (JS side)

- **pnpm workspaces + Turborepo** to manage `apps/web` + `packages/*`. Fast,
  Vercel-native, standard for this shape.
- `apps/api` (Python) is a separate deployable; Turborepo doesn't manage Python,
  but keeping it in the same repo gives us one place for the whole product
  (shared docs, one PR spans frontend + backend for a tool).

## Deploy targets (recap from `01`)
- `apps/web` → **Vercel**.
- `apps/api` → **container on a VM** (Fly.io / Render) — needs ffmpeg + yt-dlp
  binaries, long-running jobs, and a stable IP to reduce Instagram blocking.
- Frontend reaches backend via `NEXT_PUBLIC_API_URL` (the proven ReelScribe pattern).

## Tool registry (makes the home page self-updating)
A single `apps/web/app/lib/tools.ts` array describes each tool (slug, name,
description, icon). The home page maps over it; adding a tool = adding an entry.
This is the small thing that keeps "a collection of tools" from becoming a mess.
```
