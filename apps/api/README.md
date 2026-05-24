# apps/api — Python backend

FastAPI service that does the real work (downloading + transcribing). The Next.js
frontend (`apps/web`) calls it. See `../../Architecture/02-transcriber-design.md`.

## Layout
```
app/
├── main.py            # FastAPI app; mounts every tool's router
├── config.py          # settings from env / .env
├── shared/            # reused by ALL tools
│   ├── downloader.py  # yt-dlp + cookies + typed-error classification
│   ├── audio.py       # ffmpeg -> 16kHz mono wav
│   ├── jobs.py        # background-job store (poll-based)
│   └── errors.py      # typed, user-facing errors
└── tools/
    └── transcribe/    # tool #1
        ├── router.py  # POST /tools/transcribe, GET .../{job_id}
        ├── service.py # the 3-stage pipeline
        ├── schemas.py
        └── engines/   # local_whisper | openai | assemblyai (swappable)
```

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
1. Create `app/tools/<tool>/router.py` exporting an `APIRouter` named `router`.
2. Reuse anything in `app/shared/`.
3. Include it in `app/main.py`. Done.

## Hosting notes
- Set `IG_COOKIES_FILE` — Instagram blocks data-center IPs, so a logged-in
  cookie is effectively required on a server.
- Set `TRANSCRIBE_ENGINE=openai` (+ `OPENAI_API_KEY`) in production; local Whisper
  needs a GPU to be fast.
- Deploy as a container on a VM (ffmpeg + yt-dlp binaries, long jobs, stable IP),
  not serverless.
