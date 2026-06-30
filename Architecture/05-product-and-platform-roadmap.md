# 05 — Product & Platform Roadmap (revenue-first)

**Status:** planning · drafted 2026-06-14 · supersedes the sequencing in `ROADMAP.md`
(which stays the per-tool detail sheet). This is the **decision record** for *what
order we build in and why*, covering **tools + platform features (DB schema,
credits/tokens, payments) + scaling**, prioritized **revenue-first**.

Research behind it: market/competitor sweep, token/credit metering patterns, and
payments/DB-schema patterns — all cited inline below (§9). Read alongside
`04-scalable-structure-plan.md` (the codebase structure decision) and `ROADMAP.md`
(the ranked tool list).

---

## 1. Where we are (honest state, 2026-06-14)

**Architecture: done.** Phases 0–6 of the restructure are shipped — monorepo
(pnpm + Turbo), `apps/web` (Next 16) + `apps/api` (FastAPI, layered) + generated
`@repo/api-client`, TanStack Query data layer, durable jobs platform, both LLM
providers (`providers/llm`), scaffolding (`pnpm new-tool`). The vertical-slice
pattern is enforced (import zones, auto-discovery).

**Tools shipped (8):** Transcribe, Profile Reels, Downloads, Hashtags, Overview,
Cover, Top Reels (ranking), Bulk Export. All no-login, all free today.

**Platform primitives already in place (load-bearing for monetization):**
- **Auth** — better-auth Google OAuth, sessions in Postgres. BFF proxy injects
  `x-user-id` + internal key; FastAPI trusts only the proxy (`core/auth.py`).
- **DB + migrations** — Postgres, SQLAlchemy, **Alembic is set up** with 2
  migrations (`create_jobs_table`, `jobs_durability_and_cost`). Only one model
  today: `Job`.
- **Jobs platform** — durable rows with `user_id`, `tokens_in/out`, `cost_cents`,
  `params`, `result`, reaper for crashed jobs. Worker can split out via fly.toml.
- **Billing seam** — `jobs/quota.py::check_quota(db, user_id, tool)` exists as a
  **no-op stub** that already raises `QuotaExceededError` (402) when wired. The
  AI-tool pattern records `cost_cents`/tokens per job. *Nothing is enforced yet.*

**What does NOT exist yet:** any credit/token ledger, any payment integration, any
user-facing billing, any subscription/plan concept, enforcement in `check_quota`,
a real DB schema beyond `jobs` (+ better-auth's tables).

**The one external blocker:** the no-login IG technique is verified from a
**residential IP only**; a data-center host (Fly.io) gets blocked. Hosting needs
residential/mobile proxies, a 3rd-party fetch API, or `IG_COOKIES_FILE`. This is a
**pre-launch gate**, tracked in `BACKLOG.md`.

---

## 2. Strategic thesis (what the market research tells us)

Three findings drive the whole plan:

1. **Transcription is open whitespace.** Across 10 competitors (Metricool,
   Iconosquare, Sprout, Later, Hootsuite, Vista Social, Flick, Predis, Shortimize,
   Retensis) **none markets reel transcription** [a][b][c]. We already have a
   swappable transcription engine. Everything we build should compound on
   transcripts — that's the moat.

2. **Scraping/downloads are commodity.** OSS (Instaloader, yt-dlp) does it free
   [d]. Our shipped tools are good *acquisition*, not *revenue*. Don't gate them
   hard; use them as the free funnel.

3. **AI-native tools meter by credits; the big suites bundle.** Predis charges
   granular per-generation credits (video = 200/8s), Later gives small monthly AI
   credits + cheap top-ups, Vista splits credit pools [e][f][g]. Our `cost_cents`
   infra is already built for this — we can pick a credit model deliberately
   instead of retrofitting.

**Positioning:** a **transcript-first Instagram intelligence suite**. Free no-login
utilities pull users in; paid **AI features built on transcripts** (repurposing,
hook analysis, transcript search, voice-matched captions) are what they pay for.
Entry tier ~$15–$29 with a real free plan undercuts the suites ($25–$99 floors)
while matching AI-native expectations [a][f].

---

## 3. Revenue-first sequencing (the spine)

The principle: **the shortest path to a defensible, billable product**, then
expand. Five phases. Each is independently shippable.

```
Phase A  Pricing decision + DB schema design        ← think before building
Phase B  Monetization rails (credits + Stripe)      ← can charge money
Phase C  Flagship paid tools (the transcript wedge)  ← worth paying for
Phase D  Hosting/proxy gate + paid launch            ← actually sell it
Phase E  Breadth: more tools, login tier, scale      ← grow
```

Phases A→B→C can largely proceed in parallel with continued free-tool work, but
**D (launch) cannot happen until A–C + the proxy decision are done.**

---

## PHASE A — Pricing model + database schema design

*This is the "think about our schema" step you asked for. No feature code until the
schema is designed deliberately, because credits + payments + future orgs all hang
off it.*

### A1. Decide the pricing & packaging model (a decision, not code)

Recommended, synthesized from the research [e][f][g][h]:
- **Single pooled credit per account** (not per-seat — power users dominate
  consumption [h]). Credits abstract over LLM tokens + transcription minutes +
  scrapes.
- **Hybrid packaging:** a free monthly credit grant (acquisition) + paid
  subscription tiers with larger monthly grants + **prepaid top-up packs** +
  optional PAYG overage [h][i].
- **Anchor:** `1 credit ≈ $0.01–$0.02`; price each action as a multiple of the
  cheapest action. Keep dollar→credit simple ($1 = 100 credits); complexity lives
  in credit→action [h][j].
- **Margins:** charge **3.5–5× raw cost**, add a **15–25% buffer** for unknown LLM
  output length, **round transcription up to the whole minute**, price against the
  *most expensive* provider we might route to [k][l]. Breakage (unused credits) is
  margin — credits expire (monthly grants roll 2–3 months FIFO) [h][i].
- **Gate cheap-to-serve value by tier** (history retention, # tracked competitor
  accounts, export volume, seats) — the universal SaaS levers [a][f].

> Open decision for the user (§8): exact tier prices and the free-grant size.

### A2. Design the full schema (deliberately, all at once)

Design the target schema now so migrations are additive, not rewrites. Tables:

**Identity / tenancy** (mostly better-auth's, plus a tenancy seam)
- `user`, `session`, `account`, `verification` — better-auth owns these.
- **Add a `tenant_id` / `reference_id` column to every tenant-scoped table now,
  set to `user_id` today.** This is the single decision that makes a future
  teams/orgs layer a *backfill, not a rewrite* [m][n]. Use better-auth's
  `referenceId` convention (its Stripe plugin already uses it for user-vs-org
  subscriptions) [o].

**Credits (we own this — it's the enforcement hot path)** — append-only ledger,
copying `pgledger` / `token_ledger` patterns [p][q]:
- `credit_account(user_id PK, balance_cents/credits cached, version)` — cached
  projection for fast reads.
- `credit_ledger(id, user_id, delta, balance_after, reason, job_id, parent_txn_id,
  stripe_ref, created_at)` — **append-only, never UPDATE/DELETE**; corrections are
  reversing entries [p][r].
- `grants(account_id, amount, priority, effective_at, expires_at, max_rollover)` —
  free/included allotment with priority burndown (free credits burn before paid)
  [s][i].
- `usage_events(id, user_id, job_id, meter, tokens_in, tokens_out, raw_quantity,
  rated_credits, cost_cents, idempotency_key)` — rating view over the job row;
  mirrors columns already on `Job` [t].

**Billing (Stripe is source of truth; we mirror)** [u][v]:
- `subscription` — better-auth's Stripe plugin manages this (plan, status,
  periodStart/End, cancelAtPeriodEnd, trialEnd, seats, referenceId) [o].
- `payment_event(id=stripe_event_id PK UNIQUE, type, payload jsonb, processed_at,
  status)` — **webhook idempotency + audit seam**; dedupe on Stripe's event id [u].
- `invoice` mirror (status, amounts, hosted_url, period) for billing-history UI +
  reconciliation [u][w].
- (Optional) `product` / `price` cache of the Stripe catalog.

**Schema conventions** (from scaling research [x][y]):
- **UUIDv7** PKs for externally-exposed entities (URL/API-leaked: users, jobs,
  subscriptions) — time-ordered, index-friendly. `bigint` identity for
  high-volume internal append rows (`credit_ledger`, `usage_events`).
- Index every FK + every filter/sort column; composite `(user_id, created_at)` on
  ledger/usage tables.
- Append-only journal/audit over scattered soft-deletes; `deleted_at` only where
  undelete matters, guarded by RLS so isolation isn't "remember the WHERE" [z][n].

### A3. Migration path

Alembic already exists — **new tables are just new revisions**, no baselining
needed. Discipline to add [aa]:
- Expand/contract for changes with data present (add nullable → backfill → enforce
  NOT NULL in separate steps).
- Run `alembic upgrade head` in the deploy pipeline before new app code; gate CI on
  migrations applying to a throwaway DB (extend `pnpm quick-check`).
- Watch for multiple heads on concurrent branches (`alembic merge`).

**Phase A deliverable:** a schema migration (or a few) creating credits + billing
tables with the `tenant_id` seam, plus the agreed pricing model written down.

---

## PHASE B — Monetization rails (can charge money)

### B1. Credit ledger + reserve/settle wired to jobs

The job lifecycle becomes the metering hook [q][bb]:

| Job event | Ledger action | Amount |
|---|---|---|
| `enqueue` (after `check_quota`) | **reserve** | padded p90 estimate |
| `complete` | **capture** actual + **release** remainder | real `cost_cents` |
| `fail` / `interrupted` (incl. reaper) | **release** full hold | the reserved amount |

- **Enforce with a guarded atomic UPDATE** (`SET balance = balance - :c WHERE id=:id
  AND balance >= :c`, check rows-affected) — no read-then-write race [cc].
- **The reaper must release holds** for dead jobs, or credits leak [bb].
- **Idempotency** via per-step keys derived from the job/txn id; refunds are
  forward reversing entries, never row reverts [q][dd].
- Make `check_quota` real: check balance/plan limits here (it already raises 402).

### B2. Payments via the better-auth Stripe plugin

`@better-auth/stripe` in `apps/web` handles the heavy lifting [o]:
- Auto-creates Stripe customer on signup; adds `stripeCustomerId` to `user`.
- Manages the `subscription` table + subscription webhooks
  (`customer.subscription.*`, `checkout.session.completed`).
- `authClient.subscription.upgrade(...)` drives Checkout; `referenceId` supports
  future org-scoped subscriptions.
- We add: **credit-pack purchases** (Stripe Checkout one-time → on
  `payment_intent.succeeded`, append a `+credits` ledger row), and an `onEvent`
  handler for `invoice.paid` (extend access) / `invoice.payment_failed` (dunning).

Webhook discipline [u][ee]: verify `Stripe-Signature`; return 200 fast (enqueue a
job to process); dedupe on event id (`payment_event` UNIQUE); **refetch the live
object** rather than trusting payload ordering.

> **Stripe vs MoR decision (§8):** Stripe = we are merchant of record, we owe
> global VAT/GST [ff]. Paddle / Lemon Squeezy = merchant-of-record, handle tax for
> ~2% more [ff][gg]. Stripe is the better *technical* fit (better-auth plugin +
> usage credits); an MoR removes tax-filing pain at small global scale. Lean
> Stripe given the plugin, revisit if tax compliance bites.

**Phase B deliverable:** users can buy a subscription + credit packs; every job
reserves/settles credits; quota is enforced. The product is now billable.

---

## PHASE C — Flagship paid tools (worth paying for)

Build the **transcript wedge** first — these have no direct competitor and justify
the subscription. Ordered by value × readiness:

1. **Reel Repurposer (AI)** [ROADMAP N3] — transcript → thread / blog / YT
   description / summary. *Exercises the full AI+credits+jobs path end-to-end* —
   build this first to validate the rails. Differentiator: we have transcripts;
   nobody else does [a][b].
2. **Transcript Search / "what they talk about"** *(new — not yet in ROADMAP)* —
   search a creator's reels by spoken content; theme extraction over top reels.
   Analogous to Shortimize's AI search but exposing the actual text [c]. Strong
   WTP at $99+ proven by Shortimize.
3. **Hook Analyzer (AI)** [ROADMAP N5] — first spoken line + first caption line →
   hook-pattern classification. Competes with Retensis but data-driven from real
   top reels [b].
4. **Caption & Hook Generator (AI)** [ROADMAP N4] — voice-matched captions grounded
   in the account's *actual transcripts* (deeper than Later/Flick brand voice) [f].

**Free acquisition tools to ship alongside** (no-login, no AI cost, cheap funnel):
- **Best Time to Post** [N1] — table-stakes; every suite has it [a]. Good first
  free-tier hook; validates the new scaffolding.
- **Competitor Compare** [N2] and **Content-Style Report** [N7] — composition over
  existing endpoints, no backend module.

**Deprioritize (saturated / margin traps):** generic AI captions without transcript
grounding, scheduling/publishing (crowded, Meta-API-heavy), AI video generation
(Predis owns it, most expensive to run), social listening (enterprise) [a][e].

**Phase C deliverable:** 2–3 transcript-AI tools behind credits + a couple free
funnel tools. There is now a reason to pay.

---

## PHASE D — Hosting / proxy gate + paid launch

The pre-launch blocker. Before public paid launch, resolve IP blocking [BACKLOG]:
- **Option 1:** residential/mobile rotating proxies (per-request cost).
- **Option 2:** a 3rd-party IG fetch API (offload the blocking problem).
- **Option 3:** `IG_COOKIES_FILE` warm session (flaky from data-center IPs).

Also wire **PgBouncer** (transaction pooling) before launch — FastAPI opens many
short connections; this is the first scaling need, cheap and early [hh]. (With
transaction pooling, use SQLAlchemy `NullPool` in `core/db.py` [hh].)

Plus pre-launch polish from BACKLOG: transcript output UX (dedicated results view /
export), large-account paging.

**Phase D deliverable:** hosted, billable, launchable.

---

## PHASE E — Breadth, login tier, scale (grow)

- **More no-login tools** [ROADMAP N6 Trending Audio, N8 Hashtag Set Generator].
- **Login-gated tier** [ROADMAP P1–P6] — biggest unlock first: **P1 Real
  Engagement Analytics** (saves/shares/reach/completion) massively upgrades N1, Top
  Reels, Hook Analyzer. Needs IG session cookies + proxies (heavier blocking risk).
  **P6 Follower Growth Tracking** needs cron + time-series storage (a partitioning
  candidate).
- **Scale infra, in order of need** [hh][ii][jj]: PgBouncer (done in D) → read
  replicas with LSN-aware routing when reads dominate → **time-partition**
  `jobs` / `credit_ledger` / `payment_event` on `created_at` via `pg_partman` when
  they grow → Citus sharding on `tenant_id` only if we outgrow one node.
- **Teams/orgs** — when demanded; the `tenant_id`/`referenceId` seam from Phase A
  makes it additive.

---

## 4. Build-vs-adopt calls

- **Credit ledger:** **build** (own Postgres). It's the enforcement hot path, it's
  ~one schema to copy (`pgledger`/`token_ledger`), and the jobs platform is already
  shaped for it [p][q].
- **Payments/invoicing/dunning:** **adopt** Stripe (via better-auth plugin) — don't
  hand-roll [o][u].
- **Metering/entitlement engine:** **build thin** for now. If we later want a
  self-hosted engine, **OpenMeter (Apache-2.0)** fits better than Lago (which gates
  real-time balance behind premium + AGPL) [kk][ll].
- **Transcription at scale:** lean on **faster-whisper / WhisperX** (word
  timestamps enable transcript search) over raw whisper [mm].

---

## 5. Reference implementations to study (OSS)

- **Postiz** (github.com/gitroomhq/postiz-app) — closest topology mirror:
  pnpm-workspaces monorepo, Next + Nest + Postgres + durable jobs + per-network
  provider abstraction [nn].
- **Instaloader / instagrapi** — IG fetch technique, session/rate-limit, proxy
  rotation (instagrapi = authenticated-fallback reference) [d].
- **faster-whisper / WhisperX** — transcription at scale [mm].
- **pgledger / token_ledger / OpenMeter / Lago** — credit ledger + metering
  schemas [p][q][kk][ll].

---

## 6. What's still missing / risks I'd flag

1. **Hosting/IP is the real launch risk** — everything else is in our control;
   this isn't. Decide the proxy strategy early (it has recurring cost that feeds
   into credit pricing).
2. **Transcription cost is the margin risk** — it scales with audio minutes and
   varies 2×+ by provider. Price credits against the priciest route, round up to
   the minute [l].
3. **No observability/analytics yet** — before paid launch we want error tracking
   (Sentry) + product analytics (PostHog is connected) + usage dashboards. Not
   called out anywhere currently. Add to Phase D.
4. **No rate limiting at the proxy** beyond auth — abuse protection for free tier
   needed before launch.
5. **Reconciliation job** — periodic check of `cached_balance` vs `SUM(ledger)` and
   `usage_events` vs ledger spend; cheap insurance, easy to forget [r].

---

## 7. Phase → deliverable summary

| Phase | Theme | Key deliverables | Gate to launch? |
|---|---|---|---|
| **A** | Pricing + schema | pricing model written; credit + billing tables migrated; tenant_id seam | yes |
| **B** | Rails | credit ledger + reserve/settle; Stripe subs + credit packs; quota enforced | yes |
| **C** | Paid tools | Reel Repurposer, Transcript Search, Hook Analyzer + free funnel tools | yes |
| **D** | Launch | proxy decision; PgBouncer; observability; UX polish | — |
| **E** | Grow | more tools; login tier (P1 first); scale infra; orgs | no |

---

## 8. Open decisions (need the user)

1. **Tier prices + free-grant size** — e.g. Free (N credits/mo) / Pro $X / Studio
   $Y? Recommendation: Free + ~$19 + ~$39, credits scaled to transcription minutes.
2. **Stripe vs Merchant-of-Record** — Stripe (we file tax) vs Paddle/Lemon Squeezy
   (they file, ~2% more). Recommendation: Stripe (plugin + credits fit).
3. **Proxy strategy** — own residential proxies vs 3rd-party fetch API vs cookies.
   Recommendation: spike a 3rd-party fetch API first (lowest ops).
4. **Launch scope** — minimum tool set to charge for. Recommendation: Repurposer +
   Transcript Search + Best Time + Competitor Compare.

---

## 9. Citations

Market/competitor: [a] metricool/later/sprout/vista/hootsuite pricing pages ·
[b] retensis.com, autoposting.ai (Iconosquare), aitoolradar (Flick) ·
[c] shortimize.com (AI search, pricing) · [d] github.com/instaloader/instaloader,
subzeroid/instagrapi · [e] predis.ai/pricing · [f] later.com/pricing (AI credits
+ top-ups) · [g] vistasocial.com/pricing (split credit pools).

Credits/metering: [h] chargebee prepaid-credit guide, schematichq AI-credits ·
[i] getlago wallet/prepaid, zenskar token-based · [j] schematichq credit-based ·
[k] dodopayments price-ai-wrapper, aikeedo · [l] assemblyai/deepgram/openai
transcription pricing, codeant LLM cost · [p] github.com/pgr0ss/pgledger ·
[q] github.com/wuliwong/token_ledger (reserve/capture/release) · [r] slope-stories
payments-ledger pitfalls, pgrs.net double-entry · [s] openmeter grants/entitlements ·
[t] existing `Job` columns · [bb] stripe authorization-holds, restate sagas ·
[cc] pjam.me atomic SQL, oneuptime race conditions · [dd] saga/idempotency refs ·
[kk] github.com/openmeterio/openmeter · [ll] github.com/getlago/lago.

Payments/DB: [m] citusdata designing-for-scale, planetscale tenancy · [n] wellally
multi-tenant, RLS · [o] better-auth.com/docs/plugins/stripe · [u] stripe
subscriptions/webhooks docs, sequin source-of-truth, amplifiedcreations ·
[v] stripe billing credits/meters · [w] altuntasfatih42 double-entry in Postgres ·
[x] UUIDv7 vs bigint (scalingpostgres) · [y][z] oneuptime soft-deletes,
levelup journaling · [aa] alembic cookbook, ygsh0816 best-practices ·
[ee] dev.to NestJS webhook idempotency · [ff][gg] fintechspecs / globalsolo
MoR comparisons · [hh] kinde scaling-stripe, pgbouncer · [ii] brandur.org
postgres-reads (LSN routing) · [jj] aws pg_partman, percona time-based ·
[mm] github.com/SYSTRAN/faster-whisper, m-bain/whisperX · [nn]
github.com/gitroomhq/postiz-app.

*(Full URLs in the research session transcript; this is the condensed index.)*
