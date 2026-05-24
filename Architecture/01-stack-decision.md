# Architecture Decision: Stack & Project Shape

This is a **collection of Instagram tools**, not a one-off script. The reel
transcriber is tool #1. The architecture has to leave room for tools #2, #3, etc.
(downloader, caption writer, hashtag tools, the existing `video-topics` idea...).

## The core tension

The work that matters (downloading reels, transcribing audio) is **Python-native**:
- `yt-dlp` — best-in-class, Python.
- `whisper` / `faster-whisper` — Python.
- `ffmpeg` — CLI, called from Python.

But a nice **UI** (paste a link, see the transcript, manage a toolset) is best in
**Next.js / React**.

## Recommendation: Monorepo — Next.js frontend + Python (FastAPI) backend

```
instagram-tools/
├── apps/
│   ├── web/            # Next.js — the toolset UI (one page per tool)
│   └── api/            # Python FastAPI — does the real work
│       ├── tools/
│       │   └── transcribe/   # tool #1
│       └── shared/           # downloader, ffmpeg helpers reused by all tools
└── ...
```

**Why this shape:**
- Python backend = we use the exact same proven libraries the working repos use.
  No fighting to do video/ML work in JavaScript.
- Next.js frontend = clean UI, easy to add a new tool as a new page/route.
- Monorepo = one repo, tools share the downloader + ffmpeg + cookie handling
  instead of each reinventing it.
- The frontend just calls the API: `POST /api/transcribe { url }` → `{ text }`.

**Rejected alternatives:**
- *Pure Next.js (no Python)* — would force us to reimplement yt-dlp/Whisper in JS
  or shell out awkwardly. Fights the ecosystem. ✗
- *Pure Python + Streamlit* (like Transcribe-Reels) — fast to prototype, but ugly
  and doesn't scale to a polished multi-tool product. Good for Phase-0 spike only.
- *Two separate repos* — splits shared code, more overhead for a solo project. ✗

## DECIDED: transcription engine — multi-engine, cloud default + local option

We are **not** picking just one. The engine is swappable behind an interface
(`TranscriptionEngine`), selected by env var `TRANSCRIBE_ENGINE`. We ship:

1. **Cloud API engine — the default for the hosted app.** (Hosted servers have no
   free GPU, so a local model is impractical in production.) Start with
   **OpenAI Whisper API** (~$0.006/min, simplest/cheapest); **AssemblyAI** is the
   second cloud engine to add if we want speaker labels + timestamps for subtitles.
2. **Local Whisper (`faster-whisper`)** — first-class selectable option, for running
   on your own machine / local dev. Free, private, no keys, offline.

> If you'd rather the cloud default be AssemblyAI instead of OpenAI, say so — it's
> a one-line env change, not a rebuild.

## DECIDED: runtime — hosted web app (end users are just visitors)

You chose a **hosted web app**, and clarified you'll **send it to someone else to
use, and they won't host it**. So the target user is a **visitor to a deployed
site** — paste a link, get a transcript, **no install / no Python / no API keys on
their end**. Everything runs server-side; **local Whisper is only for our dev**, the
**cloud engine** does all production work. Polish (clean UI, loading/error states,
no crashes on a bad link) matters more here than for a personal script.

We're accepting the known costs of hosting (see `Research/02`):
- **Instagram blocks data-center IPs** → the backend **must** support cookies, and
  downloads can still be flaky. The downloader is built cookie-ready from day one.
- **No free GPU on a server** → production uses the **cloud engine**, not local Whisper.
- We'll still keep **local engine + local dev** working so you can develop and test
  without burning API credits.

## Deployment shape (hosted)
- **Frontend (`apps/web`, Next.js)** → Vercel. Easy.
- **Backend (`apps/api`, Python/FastAPI)** → a **container on a VM** (Fly.io / Render
  / a small box), **not** serverless. Reasons: ffmpeg + yt-dlp binaries, long-running
  transcription, and we want a **stable IP** (ideally residential/proxy) to reduce
  Instagram blocking. This is the main operational work item of going hosted.
