# Instagram Tools

A scalable collection of tools for Instagram users. **Tool #1: Reel Transcriber** —
paste a reel link, get the transcript. Built so new tools are cheap to add.

## Monorepo layout
```
apps/
├── web/          # Next.js 16 dashboard (shadcn/ui). The UI for every tool.
└── api/          # Python FastAPI backend. Does downloading + transcription.
Research/         # how it works + the open-source tools we studied
Architecture/     # stack + system design decisions
Implementation/   # Phase 0 throwaway spike (proves the pipeline)
```
The app lives in `apps/`. The other folders are planning + reference (see each
folder's docs). Adding a tool = one backend folder + one frontend page + one
registry entry — see `Architecture/03-monorepo-layout.md`.

## How it works (no magic)
Every reel transcription is the same 3 stages: **download (yt-dlp) → extract audio
(ffmpeg) → transcribe (Whisper/cloud)**. There's no secret Instagram API. Cookies
are optional locally but required when hosted (Instagram blocks server IPs).
Details in `Research/`.

## Run it locally

Prereqs: Node 20+, pnpm, Python 3.9+, ffmpeg.

**1. Backend** (terminal 1):
```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # default engine = local_whisper (free, no key)
uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (terminal 2):
```bash
pnpm install                    # at repo root (first time only)
pnpm --filter web dev           # http://localhost:3000
```

Open http://localhost:3000, go to the Reel Transcriber, paste a **public** reel
link, and hit Transcribe. (First run downloads the Whisper model once.)

## Status
- ✅ Phase 0 spike — pipeline proven end to end (`Implementation/phase0-spike/`)
- ✅ Monorepo scaffolded — Next.js dashboard + FastAPI backend
- ✅ Tool #1 (Reel Transcriber) — working end to end, swappable engines
- ⏭️ Next: hosting (cookies + container deploy), then tool #2

## Key decisions (the short version)
- **Stack:** monorepo, Next.js frontend + Python/FastAPI backend, pnpm + Turborepo.
- **UI:** built minimally from shadcn/ui official blocks; a tool registry drives
  the sidebar + home grid (`apps/web/src/lib/tools.ts`).
- **Engine:** swappable — `local_whisper` (dev, free) | `openai` (prod) |
  `assemblyai` (speaker labels). Set via `TRANSCRIBE_ENGINE`.
- **Runtime:** hosted web app; frontend → Vercel, backend → container on a VM.

## Read the docs in this order
1. `Research/02-how-it-works.md` — plain-English explainer + the cookies answer
2. `Research/03-code-study.md` — what we copied/avoided from real repos
3. `Architecture/01-stack-decision.md` & `03-monorepo-layout.md` — how it's built
4. `Architecture/02-transcriber-design.md` — tool #1 design
