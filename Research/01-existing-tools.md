# Research: Existing Instagram Reel Transcription Tools

Survey of working open-source tools on GitHub that do reel transcription, and
what we can learn from each. Goal: copy the proven parts, skip the broken parts.

## The tools that actually exist and work

| Repo | Download | Audio extract | Transcription | Frontend |
|------|----------|---------------|---------------|----------|
| [AmitabhMorey/insta-transcribe](https://github.com/AmitabhMorey/insta-transcribe) | **yt-dlp** | ffmpeg-python | **openai-whisper** (local) | CLI, JSON output |
| [Muzammil-Elahi/ReelScribe-and-ReelWrite](https://github.com/Muzammil-Elahi/ReelScribe-and-ReelWrite) | Instaloader | (via API) | **AssemblyAI** | CLI / script |
| [Shrinjita/Transcribe-Reels](https://github.com/Shrinjita/Transcribe-Reels) | Instaloader | MoviePy | **AssemblyAI** | Streamlit web app |
| [getthescript/instagram-transcript-generator](https://github.com/getthescript/instagram-transcript-generator) | (browser-side) | — | hosted service | Browser extension |

## The pattern they all share

Every working tool is the **same 3-stage pipeline**:

```
Instagram URL  →  [1] DOWNLOAD video  →  [2] EXTRACT audio  →  [3] TRANSCRIBE  →  text
```

Nobody talks to a secret "Instagram transcription API" — Instagram doesn't expose
one. The reel is just an MP4 with an audio track. You download the video, pull
out the audio, and run it through a speech-to-text engine. That's the whole trick.

## Stage-by-stage findings

### [1] Download — `yt-dlp` vs `Instaloader`

Both are mature and maintained. Key differences:

- **yt-dlp** — gets the highest quality (up to 1080x1920 vp9), general-purpose,
  huge community, fast to fix when Instagram changes things. Can read browser
  cookies directly. **This is the better choice for us.**
- **Instaloader** — Instagram-specific, great at *metadata* (caption, timestamp,
  geotag, likes), but caps at 720p and is more prone to breaking on Instagram changes.

> Recommendation: **yt-dlp** for the video, optionally Instaloader later if we
> want rich metadata for other tools in the suite.

### [2] Audio extraction — `ffmpeg` vs `MoviePy`

- **ffmpeg** (directly or via `ffmpeg-python`) — fast, the industry standard.
- **MoviePy** — easier Python API but it's just a wrapper over ffmpeg anyway.

> Recommendation: call **ffmpeg** directly. Actually, Whisper accepts MP4 directly
> (it shells out to ffmpeg internally), so for local Whisper we may not even need
> a separate extraction step. For an API-based engine we extract to a small audio
> file to upload less data.

### [3] Transcription — three real options

| Engine | Cost | Setup | Speed | Extras |
|--------|------|-------|-------|--------|
| **Local Whisper** (`openai-whisper` / `faster-whisper`) | Free | Download model (~150MB–3GB) | Slow on CPU, fast on GPU | Runs offline, no keys |
| **OpenAI Whisper API** | ~$0.006/min | API key | Fast | Cloud, simple |
| **AssemblyAI** | Paid (free tier) | API key | Fast | **Speaker labels + timestamps** |

All three are proven in the repos above. This is the **one real decision** for
the user to make — see `Architecture/01-stack-decision.md`.

## See also
- `02-how-it-works.md` — the cookies/login question answered, and gotchas.
