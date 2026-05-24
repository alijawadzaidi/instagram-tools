# Phase 0 Spike — reel → transcript

The smallest proof the pipeline works: paste a reel URL, get text printed.
Local-only, throwaway. No web app, no cookies, no cloud API. See
`../../Architecture/02-transcriber-design.md` for why this exists.

```
URL → yt-dlp downloads MP4 → Whisper transcribes (uses ffmpeg) → prints text
```

## Requirements
- **ffmpeg** — already installed on this machine ✅ (`ffmpeg -version`)
- **Python 3.9+** — present ✅

## One-time setup
From this folder (`Implementation/phase0-spike/`):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
> The install pulls in `torch` (Whisper's engine) — it's a few hundred MB and may
> take a few minutes the first time.

## Run it
```bash
source .venv/bin/activate          # if not already active
python transcribe.py "https://www.instagram.com/reel/XXXXXXXXX/"
```
Or just `python transcribe.py` and it'll ask for the URL.

The **first run** also downloads the Whisper "base" model (~140 MB), once.

## What to expect
- Use a **public** reel (private ones need login/cookies — that's Phase 1+).
- A music-only reel with no speech will print "(no speech detected)".
- CPU transcription takes ~30s–2min depending on reel length. That's normal for
  local Whisper; the hosted version will use a fast cloud engine instead.

## If something breaks
- `Download failed` → reel is private, URL is wrong, or Instagram rate-limited you.
  Try a different public reel.
- `Transcription failed` / ffmpeg error → check `ffmpeg -version`.
- yt-dlp errors after Instagram changes something → `pip install -U yt-dlp`.
