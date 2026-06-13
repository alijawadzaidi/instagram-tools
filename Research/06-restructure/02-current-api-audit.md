# Current Backend Audit — `apps/api`

> Audited 2026-06-13. Every `.py` file read (38 files, ~1,645 LOC total).
> Scope: structure, scaling properties, gaps for the AI-tools roadmap, and problems ranked by pain at 30 tools.

---

## 1. Current structure

```
apps/api/
├── requirements.txt              # UNPINNED deps; no pyproject.toml, no lockfile
├── README.md                     # layout doc — already stale (no db/, models/, alembic/)
├── .env / .env.example           # .env.example missing DATABASE_URL + INTERNAL_API_KEY
├── alembic.ini
├── alembic/
│   ├── env.py                    # wires settings.database_url + Base.metadata
│   └── versions/
│       └── 3a7b740b4593_create_jobs_table.py   # the ONLY migration
└── app/
    ├── main.py                   # 35 LOC — FastAPI app, CORS, /health, manual router includes
    ├── config.py                 # 44 LOC — single flat pydantic-settings Settings
    ├── db/
    │   ├── base.py               # DeclarativeBase
    │   └── session.py            # SYNC engine + SessionLocal + get_db (created at import time)
    ├── models/
    │   └── job.py                # Job ORM model (the only table)
    ├── shared/                   # 840 LOC — the de-facto "everything" layer
    │   ├── auth.py               # require_internal_key dependency (X-Internal-Key, BFF secret)
    │   ├── errors.py             # ToolError taxonomy: code + http_status per class
    │   ├── jobs.py               # create_job/get_job/run_job — DB-persisted, in-process execution
    │   ├── audio.py              # ffmpeg → 16kHz mono wav (subprocess, blocking)
    │   ├── hashtags.py           # regex hashtag extraction
    │   ├── ig_http.py            # urllib-based IG primitives (headers, cookie warmup, no-redirect)
    │   ├── ig_extractor.py       # single-reel GraphQL/embed extractor (video_url/cover/caption)
    │   ├── ig_profile.py         # 206 LOC — profile info + cursor-paginated reels (BUSINESS LOGIC)
    │   ├── ig_download.py        # 138 LOC — yt-dlp quality ladder + download (BUSINESS LOGIC)
    │   └── downloader.py         # direct-CDN download w/ yt-dlp fallback
    └── tools/
        ├── transcribe/           # the "model citizen" tool
        │   ├── router.py         # POST /tools/transcribe (job), GET /{job_id} (poll)
        │   ├── schemas.py
        │   ├── service.py        # download → audio → engine pipeline (callable as plain fn)
        │   └── engines/          # the best pattern in the codebase
        │       ├── __init__.py   # lazy string-path registry + cached singletons
        │       ├── base.py       # Engine Protocol + Transcript/Segment dataclasses
        │       ├── local_whisper.py / openai.py / assemblyai.py
        ├── profile/
        │   ├── router.py         # /reels, /info — NO service.py; logic lives in shared/ig_profile.py
        │   └── schemas.py
        └── download/
            ├── router.py         # 153 LOC — /formats, /file, /cover, /image, /zip; NO service.py
            └── schemas.py
```

**Key mismatch with the frontend:** `apps/web` has **8** tools; the backend has **3** tool modules. Five frontend tools (top reels, hashtag research, bulk export, profile overview, cover downloader) are served by endpoints crammed into `profile/router.py` and `download/router.py`. The backend "tool module" boundary already doesn't match the product's "tool" concept.

---

## 2. What scales well

### 2.1 `tools/<name>/{router,schemas}.py` convention
- Self-contained vertical slices; adding a tool = new folder + one `include_router` line (documented in `app/main.py` docstring and README).
- Routers attach `dependencies=[Depends(require_internal_key)]` at the router level — auth is one line per tool, impossible to forget per-endpoint.
- Mirrors the frontend's `app/(dashboard)/tools/*` shape, which keeps the mental model consistent across the stack.

### 2.2 The engines pattern (`tools/transcribe/engines/`)
This is the strongest pattern in the codebase and the direct template for AI/LLM providers:
- `base.py`: a `Protocol` contract (`Engine.transcribe(audio_path) -> Transcript`) + plain dataclasses.
- `engines/__init__.py`: string-path registry (`"module:Class"`), **lazy import** (heavy deps like faster-whisper only load if selected), **cached singletons** (model load once per process).
- Engine selectable per-request (`req.engine`) or via config default (`settings.transcribe_engine`).
- Each engine fails loudly and early in `__init__` if its key/package is missing (`EngineError("OPENAI_API_KEY is not set.")`).

### 2.3 Typed error taxonomy (`shared/errors.py`)
- `ToolError` base with stable machine-readable `code` + `http_status` per subclass (`private`/422, `rate_limited`/429, `not_found`/404, `download_failed`/502, `no_audio`/422, `engine_error`/500).
- The frontend can branch on `error_code`; yt-dlp string errors get classified into this taxonomy (`_classify` in `downloader.py` / `ig_download.py`).

### 2.4 BFF auth seam (`shared/auth.py`)
- One dependency, shared secret with the Next.js proxy, fails closed (`if not settings.internal_api_key … 401`). Clean place to later swap in real user auth.

### 2.5 Jobs are already DB-persisted (better than expected)
- `shared/jobs.py` writes jobs to Postgres (SQLAlchemy + Alembic migration exists). Job *records* survive restarts and are readable from any instance — polling `GET /tools/transcribe/{id}` works across multiple replicas.
- Generic `jobs` table (`tool`, `status`, `input_url`, `result` JSON, `error_code`) — already tool-agnostic, ready for 30 tools.

### 2.6 Smart IG-side design
- Cursor pagination in `ig_profile.py`: opaque base64 cursor encoding `{user_id, max_id}` → one IG call per page, no re-resolving usernames (`_encode_cursor`/`_decode_cursor`).
- `download/router.py` image proxy is host-allowlisted to `cdninstagram.com`/`fbcdn.net` — not an open proxy.
- Dual download strategy (direct CDN extractor → yt-dlp fallback) hedges against IG changes.
- Temp-file hygiene is consistent: `TemporaryDirectory` in the pipeline, `BackgroundTask(shutil.rmtree)` after streaming responses.

---

## 3. What doesn't scale

### 3.1 Sync blocking I/O inside `async def` handlers — the worst bug class here
Every handler is declared `async def`, but the work inside is **synchronous and blocking**, which freezes the entire event loop (FastAPI does NOT thread-pool `async def` bodies):

| Endpoint | Blocking work on the event loop |
|---|---|
| `POST /tools/profile/reels` (`profile/router.py:34`) | `get_reels_page()` → 2–3 `urllib` calls to IG, 30s timeouts each |
| `POST /tools/profile/info` | `get_profile()` → 2 urllib calls |
| `POST /tools/download/formats` | `yt_dlp.extract_info()` — seconds of network |
| `GET /tools/download/file` | full yt-dlp download + ffmpeg mux, potentially minutes |
| `POST /tools/download/zip` | **serial** download of up to 50 reels in one request |
| `GET /tools/download/image` | `urllib.urlopen` reading the whole image into memory |

One user requesting a zip of 50 reels stalls *every other request on the instance* until it finishes. At 30 tools this is the first thing that falls over. (Only the transcribe job path does it right: `asyncio.to_thread(work)` in `jobs.py`.)

Related: `shared/ig_http.py` is hand-rolled `urllib` — manual gzip decompress, manual cookie parsing, no connection pooling, no async. This predates-style code where `httpx.AsyncClient` is the obvious replacement.

### 3.2 Jobs: persisted records, but **in-process, fire-and-forget execution**
`shared/jobs.py:run_job` does `asyncio.create_task(_runner())` in the web process:
- **Restart/deploy mid-job** → the task dies; the row stays `pending`/`running` **forever**. No reclaim, no janitor, no timeout, no retry. Users poll a zombie.
- **Multiple workers/replicas**: the job only runs on the instance that received the POST. You can read job status from any replica (DB), but you cannot *distribute* work, drain an instance, or scale workers independently of the API.
- **No concurrency control**: `asyncio.to_thread` uses the default executor (~32 threads). 40 concurrent local-whisper transcriptions = CPU starvation; nothing queues or sheds load.
- The `create_task` handle is dropped — exceptions before the inner `try` (e.g., DB down) are silently unobserved.
- No cleanup/TTL on the `jobs` table; it grows forever. No indexes on `(tool, status, created_at)`; `result` is `JSON` not `JSONB`.
- Download `/file` and `/zip` ignore the jobs system entirely (synchronous streaming), so there are **two competing long-task models**.

What's needed: a real queue (arq / Celery / Postgres-`SELECT … FOR UPDATE SKIP LOCKED` worker) + a startup reaper for orphaned `running` rows.

### 3.3 `shared/` is a grab bag; the tool ↔ shared boundary is inverted
- `ig_profile.py` (206 LOC) and `ig_download.py` (138 LOC) are **tool business logic living in shared/**: the profile tool's entire service and the download tool's entire service. The routers are thin wrappers over shared code. Meanwhile transcribe has a proper `service.py`. Three tools, two conventions.
- Tools import deep into shared internals: `download/router.py` reaches into `ig_http.BASE_HEADERS["User-Agent"]`; `transcribe/service.py` imports `ig_extractor` directly. There's no defined "platform API" — at 30 tools, any refactor of `ig_*` files touches an unknown number of tools.
- Relative-import depth (`from ....shared.errors import …` in engines) signals the layering is being fought, not used.
- "shared" mixes three different kinds of code with no separation: **infrastructure** (auth, errors, jobs), **IG client** (ig_http/extractor/profile/download), and **media utils** (audio, downloader). These should be distinct packages (`core/`, `integrations/instagram/`, `media/`).

### 3.4 Error handling is duplicated per router
The same block appears 6+ times:

```python
try:
    ...
except ToolError as e:
    raise HTTPException(status_code=e.http_status, detail=e.message) from e
```

(`profile/router.py` ×2, `download/router.py` ×4). One `app.add_exception_handler(ToolError, …)` in `main.py` would delete all of it — and guarantee the next 27 tools can't get it wrong. Also inconsistent today: the global handler would return `{code, message}`; current `HTTPException` returns `{detail}` and **drops the machine-readable `code`** that `errors.py` exists to provide (only the job path persists `error_code`).

Silent swallowing exists too: `ig_extractor.get_cover`/`get_caption` catch bare `Exception` → return `""`; `download/zip` skips failed reels with no per-URL error report; `/image` maps everything to a generic 502.

### 3.5 Config and bootstrapping fragility
- `db/session.py` runs `create_engine(settings.database_url)` **at import time** with a default of `""` — the app's startup depends on env state at import, can't be tested without a DB, and a missing var fails with a SQLAlchemy parse error instead of "DATABASE_URL is required".
- `.env.example` is missing `DATABASE_URL` and `INTERNAL_API_KEY` — a fresh clone fails in a non-obvious way.
- One flat `Settings` class. At 30 tools (each AI tool adding keys, model names, budgets) this becomes a 100-field dumping ground; needs nested settings groups (`settings.ig.cookies_file`, `settings.llm.anthropic_api_key`).
- Sync SQLAlchemy sessions (`get_db`) used inside `async def` handlers — more event-loop blocking; no `pool_pre_ping`, no pool sizing.

### 3.6 Zero tests, zero CI, zero pinning, zero logging
- No `tests/`, no `pytest.ini`/`pyproject.toml`, no lint config (ruff/mypy), no CI.
- `requirements.txt` is fully **unpinned** (`fastapi`, `sqlalchemy`, `yt-dlp`, …) — every deploy resolves different versions; no lockfile.
- `grep -rn "import logging" app/` → **zero hits**. No request IDs, no structured logs, no Sentry. When IG changes its API (the most likely failure), the only signal is users reporting blank results — and `get_caption`-style silent excepts hide it even then.
- The IG client is the highest-risk dependency in the system and has no contract tests, no recorded-fixture tests, nothing.

### 3.7 IG-courtesy inefficiencies (rate-limit exposure)
- `session_cookies()` does a full cookie warmup page-fetch on **every** request — 2 IG hits per page of reels, 2 extra hits in `transcribe_reel` just for the caption (fetched *after* the transcription, repeating the warmup).
- No caching anywhere (no Redis, no in-memory TTL cache): same profile fetched twice = full IG round trips twice. At 30 tools sharing one server IP + one cookie file, rate limiting becomes the dominant failure mode and there's no backoff/circuit-breaker layer.

---

## 4. What the upcoming AI tools need that's missing

The roadmap (20–30 tools, several LLM-based: caption writers, transcript summarizers, content analyzers) needs:

1. **An LLM provider layer** — there is no LLM client anywhere. The transcribe `engines/` pattern is the right blueprint; it should be *promoted out of the transcribe tool* into something like `app/providers/llm/` (Protocol + registry + lazy init) so every AI tool shares model selection, retries, timeouts, and a single place to add Anthropic/OpenAI keys. Today the pattern is buried 4 levels deep inside one tool.
2. **Streaming** — nothing in the app can stream. Jobs are poll-only (`GET /{job_id}`); there's no SSE/WebSocket support. LLM tools that take 10–30s feel broken without token streaming or at minimum progress events.
3. **A real task queue with chaining** — AI tools compose: download → transcribe → LLM analyze. `transcribe_reel()` being a plain callable function is great for composition, but in-process `asyncio.create_task` cannot run multi-step chains durably (a deploy mid-chain loses everything). Needs arq/Celery-style steps with per-step retry.
4. **Cost/usage accounting + a user concept** — `Job` has no `user_id`; there is no user model at all. LLM tools without per-user token accounting and quotas are an open wallet. The schema needs `user_id`, `tokens_in/out`, `cost_cents` columns (or a `usage` table) before the first AI tool ships.
5. **Result caching** — transcripts and LLM analyses are deterministic per reel (`shortcode` is a natural cache key). No cache layer exists; every re-run pays IG + ASR + LLM costs again. Redis (or even a `results` table keyed by `(tool, shortcode, params_hash)`) is a prerequisite for affordable AI tools.
6. **Prompt management** — no convention for where prompts live or how they're versioned. Decide now (e.g., `tools/<name>/prompts.py`), or prompts end up as f-strings inside routers.
7. **Observability for LLM calls** — no logging at all today; AI tools need at minimum structured logs of model/tokens/latency per call, ideally tracing (Langfuse/OTel).
8. **Per-provider settings groups** — flat `Settings` will explode; nested config (see 3.5) before keys multiply.

---

## 5. Problems ranked by pain at 30 tools

| # | Problem | Why it's #N at 30 tools | Evidence |
|---|---|---|---|
| 1 | **Blocking sync I/O in `async def` handlers** | One slow request stalls the whole instance; multiplied by 30 tools' traffic this is an outage, not a slowdown. Cheap to fix now (use `def` handlers or httpx-async), expensive after 30 tools copy the pattern. | `download/router.py` (`/file`, `/zip`, `/formats`), `profile/router.py`, `shared/ig_http.py` |
| 2 | **Job execution in-process, fire-and-forget** | Deploys orphan jobs forever; can't add worker capacity; no concurrency limits. Every new long-running/AI tool deepens the hole. | `shared/jobs.py:run_job` (`asyncio.create_task`), no reaper, no queue |
| 3 | **No tests/CI + unpinned deps + zero logging** | The IG client is reverse-engineered and *will* break; today breakage is invisible (silent `except Exception: return ""`) and every deploy is a dependency lottery. At 30 tools regressions become untraceable. | no `tests/`, `requirements.txt` unpinned, `grep logging` → 0 hits, `ig_extractor.get_caption` |
| 4 | **`shared/` grab-bag + inconsistent service layer** | 27 more tools will dump logic into `shared/` because two of three existing tools did. The "what is a tool vs platform" boundary must be defined before the count grows. | `ig_profile.py`/`ig_download.py` in shared; only transcribe has `service.py`; frontend 8 tools ↔ backend 3 modules |
| 5 | **No user/quota model + no caching** | Fine for an anonymous free tool at 8 features; fatal once AI tools spend real money per request and IG rate-limits a single shared IP/cookie. | `models/job.py` (no `user_id`), no Redis, `session_cookies()` per request |
| 6 | **Per-router error-mapping duplication & dropped error codes** | 30 copies of the try/except block, with the frontend losing `error_code` on sync endpoints. One global exception handler fixes it permanently. | 6 copies across `profile/router.py`, `download/router.py` |
| 7 | **Flat config + import-time DB engine** | 30 tools × N settings each in one class; app untestable without env/DB. | `config.py`, `db/session.py` |
| 8 | **Manual router mounting + drifting docs** | Mechanical but error-prone ×30; README already documents a structure that no longer exists (no `db/`, `models/`, jobs described as different). | `main.py` imports, `README.md` layout section |
| 9 | **Jobs table hygiene** | Unbounded growth, JSON-not-JSONB, no indexes — slow polling queries once volume exists. | `models/job.py`, migration `3a7b740b4593` |
| 10 | **Two long-task models (jobs vs streaming responses)** | Download tools stream synchronously, transcribe uses jobs; new tool authors must guess which to copy. | `download/router.py:/file` vs `transcribe/router.py` |

---

## 6. What instagram-tools should take from this

1. **Generalize the engines pattern into a `providers/` layer.** `tools/transcribe/engines/` (Protocol + string-path registry + lazy cached instances) is the house's best idea. Promote it: `app/providers/llm/`, `app/providers/transcription/`, and the IG client as `app/integrations/instagram/`. AI tools then get model/provider swapping for free, the same way transcription already does.

2. **Split `shared/` into intent-named packages and make `service.py` mandatory.** Target shape: `app/core/` (config, errors, auth, logging, db), `app/integrations/instagram/` (ig_http/extractor/profile/download), `app/providers/` (engines, future LLM), and every `tools/<name>/` gets `router.py + schemas.py + service.py`. Move `ig_profile`'s and `ig_download`'s logic behind profile/download services. Rule: routers import only their own service + core; tools never import another tool.

3. **Kill event-loop blocking before adding tool #9.** Either declare blocking handlers as plain `def` (FastAPI thread-pools them) or move IG calls to `httpx.AsyncClient` in `ig_http`. Make `/zip` a job, not a synchronous 50-download request.

4. **Add one global `ToolError` exception handler** in `main.py` returning `{code, message}`, delete the 6 duplicated try/except blocks, and have the frontend's typed client branch on `code`. This is the single cheapest consistency win.

5. **Adopt a real queue + job reaper before the AI tools land.** Postgres-backed worker (`FOR UPDATE SKIP LOCKED`) or arq/Redis; startup reaper that marks stale `running` jobs as `error: interrupted`; concurrency limits per tool family; add `user_id`, `params` (JSONB), `cost`/token columns to `jobs` now while the table is tiny.

6. **Introduce a cache + IG-session layer.** Cache cookie warmups, `username → user_id`, transcripts and LLM outputs keyed by `(tool, shortcode, params_hash)`. This simultaneously cuts IG rate-limit exposure and makes AI tools affordable to re-run.

7. **Baseline engineering hygiene in one PR:** `pyproject.toml` (pinned deps + ruff + pytest config), `tests/` with recorded-fixture tests for `ig_extractor`/`ig_profile` parsing (the most fragile, most valuable tests in the repo), structured logging with request IDs, fail-fast settings validation (no `""` defaults for `database_url`/`internal_api_key`), and an updated `.env.example`.

8. **Define the tool-module contract to mirror the frontend registry.** Backend tool modules should map 1:1 with the frontend `src/lib/tools.ts` registry (8 today, not 3) — e.g., split cover/image endpoints out of `download/` — and consider auto-discovering `tools/*/router.py` in `main.py` so "add a tool" never touches shared files. Long-term, generate the frontend's typed API client from FastAPI's OpenAPI schema so `schemas.py` is the single source of truth.
