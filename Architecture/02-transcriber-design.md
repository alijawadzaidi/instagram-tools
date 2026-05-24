# Tool #1 Design: Reel Transcriber

> **Validated against real code** — I read the source of three working repos
> (`Research/03-code-study.md`). This design copies the proven parts (modular
> 3-stage pipeline from insta-transcribe; Next.js↔separate-API contract from
> ReelScribe; AssemblyAI speaker labels from Transcribe-Reels) and adds the things
> they all lack for hosted use: **cookies, error classification, background jobs,
> env-based secrets, rate limiting.**

## Pipeline (the proven 3 stages)

```
POST /api/transcribe { url, [cookies?] }
        │
        ▼
[1] DOWNLOAD   yt-dlp  →  /tmp/<id>.mp4
        │   (cookies optional; retry path if Instagram 401s)
        ▼
[2] AUDIO      ffmpeg  →  /tmp/<id>.wav   (skip if engine eats mp4 directly)
        │
        ▼
[3] TRANSCRIBE  <engine>  →  { text, segments[] }
        │
        ▼
   cleanup temp files  →  return JSON
```

## The key abstraction: swappable transcription engine

So we're never locked into one provider, the backend defines one interface and
each engine implements it:

```python
class TranscriptionEngine(Protocol):
    def transcribe(self, audio_path: str) -> Transcript: ...

# implementations: LocalWhisperEngine, OpenAIWhisperEngine, AssemblyAIEngine
# chosen via an env var, e.g. TRANSCRIBE_ENGINE=local_whisper
```

`Transcript = { text: str, segments: [{ start, end, text }] }`
(segments are optional; only some engines return timestamps.)

## Backend modules (`apps/api/`)

- `shared/downloader.py` — wraps yt-dlp. Input URL → mp4 path. Handles cookies,
  retries, and clear errors ("private/login required", "rate-limited", "no such reel").
  **Reused by every future tool.**
- `shared/audio.py` — ffmpeg extract-to-wav helper.
- `tools/transcribe/engines/` — the engine implementations above.
- `tools/transcribe/service.py` — glues the 3 stages, does temp-file cleanup.
- `main.py` — FastAPI app, exposes `POST /api/transcribe`.

## Frontend (`apps/web/`)

- A single page: input box for the reel URL, "Transcribe" button, result panel
  with copy button. Loading state (transcription is not instant).
- A simple home/landing that will list tools as the suite grows.
- Talks to the backend over one fetch call. No business logic in the frontend.

## Error handling (don't fail silently)

Surface these distinctly to the user, never swallow them:
- Private / login-required → "This reel is private or needs login. Add cookies."
- Rate-limited / blocked → "Instagram is rate-limiting. Try again / add cookies."
- Not a valid reel URL → validate before downloading.
- No speech in audio → "Couldn't find speech in this reel."

## Build order (when we implement — NOT yet)

- **Phase 0** — `Implementation/` spike: ~20-line Python script, `url → mp4 →
  whisper → print`. Proves the pipeline end-to-end before any app scaffolding.
- **Phase 1** — Wrap it in FastAPI with the engine interface + the shared downloader.
- **Phase 2** — Next.js frontend page calling the API.
- **Phase 3** — Polish: cookies UI, error states, history, then start tool #2.

## Decisions locked in
- **Engines:** multi-engine, swappable via `TRANSCRIBE_ENGINE`.
  - Cloud default (production) = **OpenAI Whisper API** (can swap to AssemblyAI).
  - **Local Whisper** = first-class option for local dev / running on your machine.
- **Runtime:** **hosted web app.** Therefore:
  - `downloader.py` is **cookie-ready from day one** (env: `IG_COOKIES_FILE`),
    because hosted = data-center IP = Instagram will demand login.
  - Production transcribes via the **cloud engine** (no GPU on the server).
  - Backend deploys as a **container on a VM**, not serverless (needs ffmpeg/yt-dlp
    binaries, long jobs, a stable IP). Frontend → Vercel.

## New design implications from "hosted"
- **Long jobs:** transcription can take a while → the API should run it as a
  background job and the frontend polls (`POST /transcribe` → `job_id`;
  `GET /transcribe/{job_id}` → status/result). Avoids HTTP timeouts.
- **Abuse/cost control:** public site → add rate limiting + URL validation so we
  don't rack up API bills or get the server IP-banned faster.
- **Cookie management:** a single shared IG session cookie on the server, refreshed
  periodically. Document this as an operational task, not a user-facing feature (v1).
