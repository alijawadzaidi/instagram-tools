# Implementation

**Intentionally empty — nothing built yet.** We are in the plan stage.

When you give the go-ahead, code lands here in this order (from
`Architecture/02-transcriber-design.md`):

- **Phase 0** — `phase0-spike/` : ~20-line Python script, `url → mp4 → whisper →
  print`. Proves the pipeline before any app scaffolding.
- **Phase 1** — `apps/api/` : FastAPI backend, swappable engine interface, shared
  cookie-ready downloader, background-job endpoints.
- **Phase 2** — `apps/web/` : Next.js frontend page that calls the API.
- **Phase 3** — Polish (cookies ops, error states, rate limiting), then tool #2.
