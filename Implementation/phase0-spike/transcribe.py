"""
Phase 0 spike: prove the reel -> transcript pipeline works end to end.

This is intentionally tiny and throwaway. No web app, no API, no cookies,
no cloud engine. Just: download a reel, transcribe it locally, print the text.

Usage:
    python transcribe.py "https://www.instagram.com/reel/XXXXXXXXX/"
    python transcribe.py            # will prompt you for the URL

Requires: ffmpeg installed on your system, and `pip install -r requirements.txt`.
"""

import os
import sys
import tempfile


def download_reel(url: str, out_dir: str) -> str:
    """[1] Download the reel's MP4 with yt-dlp. Returns the file path."""
    import yt_dlp

    out_template = os.path.join(out_dir, "reel.%(ext)s")
    ydl_opts = {
        "outtmpl": out_template,
        "format": "mp4/bestvideo+bestaudio/best",
        "quiet": True,
        "noprogress": True,
        "retries": 3,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.extract_info(url, download=True)

    # Find whatever file got written (extension can vary).
    files = [f for f in os.listdir(out_dir) if f.startswith("reel.")]
    if not files:
        raise RuntimeError("Download finished but no video file was found.")
    return os.path.join(out_dir, files[0])


def transcribe(video_path: str) -> str:
    """[2+3] Whisper extracts audio (via ffmpeg) and transcribes it locally."""
    import whisper

    # "base" is small and fast enough to prove the concept. Bigger = more
    # accurate but slower: tiny < base < small < medium < large.
    model = whisper.load_model("base")
    result = model.transcribe(video_path)
    return result["text"].strip()


def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else input("Enter Instagram reel URL: ").strip()
    if not url:
        print("No URL given. Exiting.")
        return 1

    # Temp dir auto-deletes when we're done — no leftover files.
    with tempfile.TemporaryDirectory() as tmp:
        try:
            print("[1/2] Downloading reel...")
            video_path = download_reel(url, tmp)
        except Exception as e:
            print(f"\n❌ Download failed: {e}")
            print("   Common causes: the reel is private, the URL is wrong, or")
            print("   Instagram is rate-limiting this machine. Try a public reel.")
            return 1

        try:
            print("[2/2] Transcribing (first run downloads the Whisper model, ~140MB)...")
            text = transcribe(video_path)
        except Exception as e:
            print(f"\n❌ Transcription failed: {e}")
            print("   Is ffmpeg installed?  Try:  ffmpeg -version")
            return 1

    print("\n" + "=" * 60)
    print("TRANSCRIPT")
    print("=" * 60)
    print(text if text else "(no speech detected — the reel may be music-only)")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
