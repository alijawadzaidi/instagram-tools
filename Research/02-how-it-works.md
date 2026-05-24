# How Reel Transcription Actually Works (plain English)

You said you don't know how any of this works. Here's the honest, complete picture.

## There is no "Instagram transcription" magic

Instagram does not give developers a transcription API. The way *every* tool does
this is low-tech and reliable:

1. **A reel is just a video file (MP4).** Instagram serves it from a public URL.
2. A downloader (`yt-dlp`) grabs that MP4 — the same thing your browser does when
   it plays the reel, just saved to disk.
3. The MP4 contains an **audio track**. We pull it out (or hand the whole MP4 to
   the transcriber, which extracts audio itself).
4. A **speech-to-text model** (Whisper, AssemblyAI) listens to the audio and writes
   down the words. This is the same tech behind YouTube auto-captions and Siri.

That's it. No reverse-engineering Instagram's private APIs, no scraping tricks.

## Do I need to give it cookies? — The real answer

**For public reels: usually no, but increasingly "sometimes yes."**

- A *public* reel can be downloaded anonymously. The simple tools work with no
  login at all.
- **But** Instagram rate-limits and sometimes blocks anonymous requests,
  especially from data-center IPs (like a cloud server). When that happens you
  get errors like *"login required"* or *"rate-limited / 401."*
- The fix is **cookies**: you export your logged-in Instagram session from your
  browser and hand it to yt-dlp. To Instagram it then looks like *you*, a normal
  logged-in user, are watching the reel.

yt-dlp supports this two ways:
- `--cookies-from-browser chrome` — reads cookies straight from your browser.
- `--cookies cookies.txt` — a cookies file you export once.

**Private reels** (from accounts you follow but aren't public) *always* require
cookies from an account that can see them.

### What this means for our design
- **Running locally on your Mac** → cookies are easy and rarely even needed. Best
  reliability.
- **Running on a cloud server** (e.g. a hosted website) → Instagram blocks
  data-center IPs aggressively. You'll *need* cookies, and even then it can get
  flaky. This is the single biggest risk for a hosted version.

> Design implication: build the downloader so cookies are **optional but
> pluggable**. Start without them; add a cookies path when Instagram pushes back.

## Other gotchas the research surfaced

- **Only public content works** without auth. Private posts need a logged-in cookie.
- **Geo-restrictions** — some reels are region-locked; may fail from certain IPs.
- **Instagram changes its site often** — downloaders break periodically. yt-dlp
  fixes fast, so *keeping yt-dlp updated* is part of maintenance, not a one-time setup.
- **No audio = no transcript.** Music-only reels with no speech produce garbage or
  just lyrics. Worth detecting and messaging clearly.
- **Whisper model download** — local Whisper downloads its model on first run
  (one-time, needs internet).
- **Legal/ToS** — automated downloading is against Instagram's ToS. Fine for
  personal/educational use; just don't build a mass-scraping service.

## The minimal proof we could build first

A single Python script:
```
url  →  yt-dlp downloads mp4  →  whisper transcribes mp4  →  print text
```
~20 lines. We'll spec this as Phase 0 before building the full app.
