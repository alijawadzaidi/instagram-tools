# Backlog — deferred / known issues

Things we've consciously decided to handle later. Newest at top.

## UI/UX (deferred — tackle near the end)
- **Transcript output is awkward.** Right now each reel's transcript renders inside
  its small card (Profile Reels tool), which is cramped and hard to read or copy.
  Need a proper way to view/copy/export transcripts — e.g. a dedicated results
  panel or modal per reel, a "copy all" / export (txt/markdown/csv), maybe
  per-reel copy buttons. Applies to both tools. *Explicitly punted until UI/UX
  polish pass — don't build yet.*

## Functionality
- **Very large accounts.** Reel listing is now capped at 200 (backend hard cap
  500). Pagination works via the clips cursor, but accounts with more reels than
  the cap won't fully load. If needed, add proper "Load more" / unbounded
  cursor-based paging instead of a fixed ceiling.
- **Hosting / IP blocking.** The download technique is verified from a residential
  IP only. A hosted (data-center) deployment needs residential/mobile proxies or a
  third-party download API. See `Research/02` + `Research/05`. The real
  pre-launch decision.
