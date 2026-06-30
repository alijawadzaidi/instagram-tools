# Roadmap Checklist — do one at a time

High-level, ordered. Each box is one focused chunk of work. Detail/rationale for any
item lives in `05-product-and-platform-roadmap.md`. Check off as you go.

---

## Phase A — Decide + design (before any feature code)
- [ ] **Pick the pricing model** — tiers, prices, free-grant size, what credits buy
- [ ] **Pick payments provider** — Stripe vs Merchant-of-Record (Paddle/Lemon Squeezy)
- [ ] **Pick proxy strategy** — own proxies vs 3rd-party fetch API vs cookies (the launch blocker)
- [ ] **Design the DB schema** — credits ledger + grants + usage_events + billing/payment_event tables
- [ ] **Add `tenant_id` seam** (= user_id today) to tenant-scoped tables for future orgs
- [ ] **Write the Alembic migration(s)** for the new tables

## Phase B — Monetization rails
- [ ] **Build the credit ledger** (append-only) + cached balance
- [ ] **Wire reserve/settle to jobs** — reserve on enqueue, settle on complete, release on fail/reaper
- [ ] **Enforce `check_quota`** — make the existing stub actually check balance/limits
- [ ] **Integrate Stripe** via `@better-auth/stripe` — subscriptions
- [ ] **Add credit-pack purchases** — one-time Checkout → top up the ledger
- [ ] **Handle webhooks** — verify signature, dedupe on event id, refetch live object
- [ ] **Build the billing UI** — current plan, balance, buy credits, history

## Phase C — Flagship paid tools (the transcript wedge)
- [ ] **Reel Repurposer (AI)** — transcript → thread/blog/summary *(build first — validates the AI+credits path)*
- [ ] **Transcript Search** — search a creator's reels by spoken content
- [ ] **Hook Analyzer (AI)** — classify reel/caption hooks
- [ ] **Best Time to Post** *(free funnel tool)*
- [ ] **Competitor Compare** *(free funnel tool)*

## Phase D — Launch readiness
- [ ] **Resolve hosting/IP** — implement the chosen proxy strategy, verify from data-center
- [ ] **Add PgBouncer** (connection pooling)
- [ ] **Add observability** — error tracking (Sentry) + product analytics (PostHog)
- [ ] **Add rate limiting** at the proxy (free-tier abuse protection)
- [ ] **Polish** — transcript output UX, large-account paging
- [ ] **Reconciliation job** — ledger balance vs sum-of-entries check
- [ ] 🚀 **Paid launch**

## Phase E — Grow (after launch, as needed)
- [ ] More no-login tools (Trending Audio, Hashtag Set Generator, Content-Style Report)
- [ ] Login-gated tier — start with **Real Engagement Analytics**
- [ ] Scale infra as needed — read replicas → table partitioning → sharding
- [ ] Teams/orgs (the tenant_id seam makes it additive)
