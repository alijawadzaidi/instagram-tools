# Code Study: Reading the Actual Source

I cloned the three repos into `reference-repos/` and read their real code (not just
READMEs). Here's what's worth copying, what to avoid, and the one big gap for our
hosted use case.

## 1. insta-transcribe — the cleanest skeleton to copy

Structure is exactly the modular shape we want:
```
main.py                      # orchestrates the 3 stages
utils/downloader.py          # yt-dlp
utils/audio_extractor.py     # ffmpeg
utils/transcriber.py         # whisper
requirements.txt             # yt-dlp, openai-whisper, ffmpeg-python
```

**Downloader (the whole thing):**
```python
import yt_dlp, os
def download_reel(url, output_path="downloads/reel.mp4"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    ydl_opts = {"outtmpl": output_path, "format": "mp4"}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    return output_path
```
✅ Copy this shape. ⚠️ **No cookies, no error handling, no retries** — fine for a
local toy, *not* enough for hosted (see §4).

**Transcriber:** loads local Whisper `base` model, `model.transcribe(path)`, returns
`result["text"]`. ✅ Good as our **local engine** for dev. ⚠️ Contains a macOS SSL
hack (`CERT_NONE`) — **do not copy**, that's a local-machine workaround and is insecure.

**Audio:** `ffmpeg-python` → mp3, 44.1kHz, stereo. ✅ Fine. (Whisper downsamples to
16kHz mono anyway, so for transcription we can extract mono 16kHz wav and save bandwidth.)

## 2. Transcribe-Reels — the AssemblyAI + speaker-labels reference

```python
config = aai.TranscriptionConfig(speaker_labels=True)
transcript = transcriber.transcribe(f, config)
# then: transcript.text  and  transcript.utterances -> .speaker / .text
```
✅ This is exactly how we'd implement the **AssemblyAI engine** with speaker labels.
✅ Cleans up temp files (`os.remove`) after — good habit, we'll do the same.
⚠️ **Hardcodes the API key in source** (`aai.settings.api_key = "AssemblyAI API key"`)
— never do this; ours goes in an env var / secret.
⚠️ Uses Instaloader (downloads to a folder, then hunts for the `.mp4`) + parses the
shortcode with `url.split('/')[-2]` — clunky. We prefer yt-dlp's direct URL handling.

## 3. ReelScribe — validates our EXACT hosted architecture

This one is a **Next.js app** that calls a **separate Python backend**. Its frontend
service:
```ts
axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/get_transcript`,
           { url, model }, { timeout: 60000 })
// explicitly handles 504 Gateway Timeout
```

Takeaways — this is the architecture I proposed, already proven in the wild:
- **Frontend (Vercel) ↔ separate backend API** over HTTP. ✅ Same as our plan.
- Request shape `{ url, model }` → our `{ url, engine }`. ✅
- **They hit timeouts** — 60s axios timeout + explicit 504 handling. This is the
  real-world confirmation that **synchronous transcription in one request is fragile**.
  → reinforces our **background-job + polling** design (`Architecture/02`).
- `NEXT_PUBLIC_API_URL` env var points the frontend at the backend. ✅ We'll do this.

## 4. THE GAP that matters for you: none handle cookies / blocking

All three download with **zero auth**. That works when you run it on your laptop on
a home connection. **It will not reliably work on a hosted server**, because
Instagram blocks data-center IPs. This is the single most important thing we must
add that the reference repos *don't* have:

```python
ydl_opts = {
    "outtmpl": out,
    "format": "mp4",
    "cookiefile": os.environ.get("IG_COOKIES_FILE"),   # <-- the addition
    "retries": 3,
    "socket_timeout": 30,
}
```
Plus real error classification (private / rate-limited / not-found / no-audio).

## 5. Your clarification reframes the product

You said: *"I'm probably going to send it to someone else to use, and they won't be
hosting it."* That means:
- The end user is a **visitor to a deployed website**. They paste a link, get a
  transcript. **No install, no Python, no API keys on their end.**
- So **everything is server-side**: the cloud transcription engine does the work in
  production; local Whisper is only for *our* dev. (Confirms `Architecture/01`.)
- Polish matters more than for a personal script: clean UI, clear loading/error
  states, no crashes on a bad/private link.

## Net: what we copy vs. add
| From the repos (copy) | What we ADD (they lack) |
|---|---|
| 3-stage modular pipeline (insta-transcribe) | **Cookie support** in the downloader |
| yt-dlp direct-URL download | **Error classification** (private/blocked/no-audio) |
| AssemblyAI speaker-labels usage | **Background jobs + polling** (avoid 504s) |
| Next.js ↔ separate API contract (ReelScribe) | **Secrets in env**, never hardcoded |
| Temp-file cleanup | **Rate limiting** for a public site |
