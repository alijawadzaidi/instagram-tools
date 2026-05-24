# The Download Technique (the actual core of the product)

We over-indexed on transcription early. **Downloading the reel is the real
product** — it's the fragile, valuable part. This documents the working technique,
read from real repos and verified on live reels (May 2026).

## Where it came from
Studied `parth-dl/parth_dl/extractors.py` (cloned in `reference-repos/`). It tries
several Instagram endpoints in order; we tested each against live reels to see
which actually work today.

## What works RIGHT NOW (verified)
**GraphQL endpoint, no login:**
```
GET https://www.instagram.com/graphql/query/
      ?doc_id=8845758582119845
      &variables={"shortcode":"<CODE>", ...}
Headers: X-IG-App-ID: 936619743392459   (Instagram's public web-client id)
         X-CSRFToken + Cookie  (from warming up on the post page first)
```
Response → `data.xdt_shortcode_media.video_url` = a direct CDN MP4 URL.
We then stream that URL to disk. Verified: returns `video/mp4`, correct size,
valid `ftyp` signature, supports range requests.

**Fallback:** the `/embed/` page contains a `"video_url":"..."` we can regex out.

## What is BLOCKED now (don't rely on)
- `https://i.instagram.com/api/v1/media/{media_id}/info/` → 302 → 404 anonymously.
  (Also: urllib drops custom headers across the redirect, masking the cause.)
- `https://www.instagram.com/api/v1/media/{media_id}/info/` → 302 to login.

These were parth-dl's *primary* methods; they've since been locked down for
anonymous callers. The GraphQL path is the survivor. **Expect this to shift** —
which is exactly why our downloader tries methods in order and keeps yt-dlp as a
final fallback.

## Implemented in
`apps/api/app/shared/ig_extractor.py` (the extractor) and
`apps/api/app/shared/downloader.py` (tries extractor first, yt-dlp as fallback).
No login, no yt-dlp on the happy path — faster and lighter than shelling out.

## Listing a user's reels by username (no login) — verified
For the **Profile Reels** tool we needed username → list of reels. Same technique
family, verified live:
1. **Resolve user id:** `GET https://www.instagram.com/api/v1/users/web_profile_info/?username=<name>` (with the App-ID header) → `data.user.id`.
2. **Reels-only feed, paginated:** `POST https://www.instagram.com/api/v1/clips/user/`
   with form `target_user_id`, `page_size`, `max_id`. Each item has `media.code`
   (shortcode), `media.image_versions2` (thumbnail), `media.video_versions` (CDN).
   Paginate via `paging_info.max_id` while `paging_info.more_available`.

Implemented in `apps/api/app/shared/ig_profile.py`; shared HTTP bits factored into
`ig_http.py` (reused by the single-reel extractor too). Tool #2 lists the reels;
transcription reuses the single-reel pipeline per selected reel.

## The honest caveat (unchanged)
This is verified from a **residential IP** (a normal home/Mac connection). The
*method* is what the public download sites use, but they pair it with
**residential/mobile proxies** to survive running from data-center IPs. Hosting
this on a server still needs that proxy layer (or a third-party download API) —
the extraction technique and the IP-reputation problem are two separate things.
See `Research/02` and the hosted-runtime discussion.
