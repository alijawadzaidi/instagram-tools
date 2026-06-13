# apps/api — Python backend

FastAPI service that does the real work (downloading + transcribing). The Next.js
frontend (`apps/web`) calls it. See `../../Architecture/02-transcriber-design.md`.

## Layout
Layered: infrastructure in `core/`, external systems in `integrations/`, and
swappable implementations in `providers/`. Product logic lives only in
`tools/<slug>/`. Routers are auto-discovered by `main.py`.
```
app/
├── main.py                  # FastAPI app; auto-discovers tools/*/router.py
├── core/                    # infrastructure
│   ├── config.py            # settings from env / .env
│   ├── db.py                # Base + lazily-created engine/session
│   ├── errors.py            # typed, user-facing ToolErrors
│   ├── auth.py              # internal-key dependency (BFF)
│   └── logging.py           # structured logging
├── integrations/
│   └── instagram/           # the no-login IG client
│       ├── http.py          # request primitives + headers
│       ├── session.py       # cookie warmup (cached)
│       ├── extractor.py     # single-reel media/caption
│       ├── profile.py       # profile info + cursor-paginated reels
│       ├── download.py      # yt-dlp quality ladder
│       └── hashtags.py      # caption -> #tags
├── media/                   # audio.py (ffmpeg), downloader.py (CDN/yt-dlp)
├── providers/
│   └── transcription/       # local_whisper | openai | assemblyai (swappable)
├── jobs/                    # runner.py (background-job store, poll-based)
├── models/                  # SQLAlchemy ORM (Job)
└── tools/                   # vertical slices — the ONLY place product logic lives
    └── <slug>/              # router.py (transport) + schemas.py + service.py
```

The OpenAPI contract (`openapi.json`) and the generated TS client are produced
by `pnpm gen` at the repo root — see `../../Architecture/04-scalable-structure-plan.md`.

## Setup & run
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit if using a cloud engine / cookies

uvicorn app.main:app --reload --port 8000
```
- Health check: http://localhost:8000/health
- Interactive docs: http://localhost:8000/docs

## API
```
POST /tools/transcribe   { "url": "...", "engine": "local_whisper" }
  -> { "job_id": "...", "status": "pending" }

GET  /tools/transcribe/{job_id}
  -> { "status": "running" | "done" | "error", "result": {...}, "error_code": "..." }
```

## Adding a new tool
1. Create `app/tools/<slug>/` with `schemas.py` (the type source of truth),
   `service.py` (the product logic), and `router.py` exporting an `APIRouter`
   named `router`. Compose `integrations/`, `providers/`, `media/`, `jobs/`.
2. Raise `ToolError` subclasses for failures — no try/except in the router.
3. Run `pnpm gen` (repo root) to regenerate the typed client. Done — `main.py`
   auto-discovers the router; no shared file is edited.

## Tests
```bash
pip install -r requirements-dev.txt
pytest          # deterministic parsing + app-wiring tests (no live Instagram)
ruff check app/ tests/
```

## Hosting notes
- Set `IG_COOKIES_FILE` — Instagram blocks data-center IPs, so a logged-in
  cookie is effectively required on a server.
- Set `TRANSCRIBE_ENGINE=openai` (+ `OPENAI_API_KEY`) in production; local Whisper
  needs a GPU to be fast.
- Deploy as a container on a VM (ffmpeg + yt-dlp binaries, long jobs, stable IP),
  not serverless.
