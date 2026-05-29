# Instagram Tools — Roadmap

A ranked, living checklist of tools/features. We build **one at a time**, top to
bottom. Ranking blends *value × how ready we are to ship it* (so the order also
works as a build sequence). Each item notes what powers it, effort, what it needs,
and the honest caveat.

Legend — **Needs:** `none` (no-login, no key, data in hand) · `AI key` (an LLM key,
fine to add later) · `login` (Phase 3–4 — Instagram session cookies; deferred).
Effort: S / M / L.

---

## ✅ Shipped
- [x] **Reel Transcriber** — link → transcript (+ caption + hashtags)
- [x] **Profile Reels** — username → cursor-paginated reels → bulk transcribe
- [x] **Reel Downloads** — quality options (1080/720/540/360) + audio-only MP3; bulk zip
- [x] **Hashtag Research** — top tags (freq/%), co-occurrence combos, stats
- [x] **Profile Overview** — followers/bio/posts/verified + profile-pic download
- [x] **Cover Downloader** — high-res reel cover
- [x] **Top Reels** — rank a profile's reels by views (avg/median/top)
- [x] **Bulk Export** — reels → CSV/Markdown (link, date, views, hashtags, caption)

---

## 🎯 Next up — ranked (build top → bottom)

### N1. Best Time to Post  · Needs: none · Effort: M
Day×hour heatmap of when an account posts, and which windows correlate with higher
views. A flagship feature of every analytics tool (Metricool, Sprout ViralPost).
- **Powered by:** reel `taken_at` + `view_count` (already fetched).
- **Caveat:** it's *posting* time, not audience-active time; views ≠ full
  engagement; better with more reels loaded. Directional, not gospel.

### N2. Competitor Compare  · Needs: none · Effort: M
Two+ usernames side by side: followers, posting cadence, avg/median views, top
reels, hashtag overlap. Core of Iconosquare/Shortimize.
- **Powered by:** profile info + reels we already fetch.
- **Caveat:** only the metrics IG exposes publicly (views, not likes/saves).

### N3. Reel Repurposer (AI)  · Needs: AI key · Effort: M
Transcript → tweet thread / YouTube description / blog post / summary. **Our
differentiator** — we already produce transcripts, which most tools don't.
- **Powered by:** existing transcript + an LLM (Claude via Vercel AI Gateway).
- **Caveat:** per-use API cost.

### N4. Caption & Hook Generator (AI)  · Needs: AI key · Effort: M
Learn an account's caption style (from captions we fetch) and generate new
captions + hook lines in that voice. Matches Flick "Iris" / Predis.
- **Powered by:** captions + LLM.
- **Caveat:** API cost; quality depends on sample size.

### N5. Hook Analyzer (AI-lite)  · Needs: AI key (optional) · Effort: M
The opening of each reel — first spoken line (transcript) + first caption line —
classified into hook patterns. Inspired by Retensis' "Hook" dimension.
- **Powered by:** transcripts + captions; optional LLM for classification.
- **Caveat:** transcribing many reels is slow locally; sample-limited.

### N6. Trending Audio  · Needs: none · Effort: S–M
Which audio/music an account uses, and which tracks they reuse most.
- **Powered by:** `clips_metadata.music_info` in the clips feed (already fetched,
  not yet surfaced).
- **Caveat:** audio metadata isn't always present.

### N7. Content-Style Report  · Needs: none · Effort: S
One "how this account operates" summary: avg caption length, hashtags/post,
cadence, view distribution, emoji/CTA usage. Aggregates our existing analyses.
- **Powered by:** data already fetched.
- **Caveat:** descriptive, not predictive.

### N8. Hashtag Set Generator  · Needs: none (or AI key) · Effort: S
Turn Hashtag Research into a ready-to-paste hashtag block ("steal their set"),
optionally AI-expanded with related tags.
- **Powered by:** existing hashtag analysis.
- **Caveat:** overlaps Hashtag Research; lowest novelty.

---

## 🔐 Phase 3–4 — needs Instagram login (ranked)
Instagram session cookies on our backend unlock the data IG hides from anonymous
users. Deferred well past Phase 2. Biggest unlock first.

### P1. Real Engagement Analytics  · Needs: login · Effort: L
Watch time, completion rate, saves, shares, reach, likes/comments. The data
Instagram Insights gates. Would massively upgrade N1, Top Reels, and N5.

### P2. Hashtag Discovery / Search  · Needs: login · Effort: L
Find posts by hashtag, real-time tag volume/engagement, "risky/overused" flags
(RiteTag-style). Different endpoints, higher blocking risk → wants login + proxies.

### P3. Stories & Highlights Downloader  · Needs: login · Effort: M
Download stories/highlights (only visible when logged in).

### P4. Scheduling & Posting  · Needs: login (official Graph API + business acct) · Effort: L
Plan/auto-publish reels. Whole separate auth + API surface.

### P5. Comment Analysis / Sentiment  · Needs: login · Effort: M–L
Pull comments, summarize themes/sentiment (pairs well with AI).

### P6. Follower Growth Tracking  · Needs: login + storage/cron · Effort: L
Track followers/engagement over time. Requires a database + scheduled jobs.

---

## 🧱 Deferred polish (see BACKLOG.md)
- [ ] **Transcript output UX** — current in-card transcripts are cramped/hard to
  copy; needs a proper results view / export. (Do during a UI/UX pass.)
- [ ] **Large-account paging** — "Load more" works; revisit if accounts exceed caps.
- [ ] **Hosting / IP proxies** — download/extraction verified from a residential IP;
  hosted (data-center) deployment needs residential/mobile proxies or a 3rd-party
  download API. The real pre-launch infra decision.

## 🚫 Out of scope (for now)
- In-app video editing (CapCut territory) · AI image/design generation (Canva)
- Cross-platform fetching (TikTok / YT Shorts) — a separate fetch problem; possible
  "platform expansion" much later.

---
*Order is a recommendation, not a contract — we can reprioritize anytime. Update
this file as items ship (move to ✅) or as new ideas arrive.*
