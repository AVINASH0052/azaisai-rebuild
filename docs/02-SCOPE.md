# 02 — Scope & Priorities

This is the product-judgement doc. The brief judges "what you chose to build first,
and what you left out," so the cuts matter as much as the build.

---

## The governing principle

> Rebuild **the loop** to a higher standard. Build **foundations** for the orbit.
> Ship **nothing** that only exists to look complete.

The loop is: *sign in → pick model → prompt → generate → watch → download → find it
again later.* Everything the original does that isn't on that path — eleven admin
routes, a reposter program, referrals, six locales, eleven currencies, GA4/TikTok
attribution — is orbit. Orbit is where the original spent its later months. We have
12 hours. We do the loop properly and leave clean seams where the orbit attaches.

"Enterprise level" doesn't mean shipping an enterprise feature list in 12 hours. It
means the things that are **expensive to retrofit** are correct from commit one:
an append-only money ledger, a typed schema with migrations, RLS on every table,
a provider abstraction that isn't hardcoded to one vendor, idempotent job submission,
an audit trail, and a tenancy column that isn't `user_id`. Those cost hours now and
years later. Team invites and SSO cost days later and can wait.

---

## Tier 0 — the spine (must ship, nothing else matters if these don't)

| # | Item | Why it's first |
|---|---|---|
| 0.1 | Agent capture verified, `CAPTURE-TEST.md` green | Blocking gate. Submission is unassessable without it. |
| 0.2 | Deploy skeleton to Vercel, custom domain live | "Deployed, not localhost" is a hard requirement. Deploy on hour 1, not hour 11. |
| 0.3 | Email-OTP auth + session + protected routes | Nothing else is reachable. |
| 0.4 | Postgres schema + RLS + migrations | Retrofitting RLS is a rewrite. |
| 0.5 | Append-only credit ledger with balance projection | Money correctness is not a v2 concern. |
| 0.6 | Provider adapter interface + **mock provider** | The mock is what guarantees a working live demo regardless of API keys, quota, or spend. Build it before the real ones. |
| 0.7 | Job queue: submit → worker → status machine → realtime push | The one genuinely hard piece. |
| 0.8 | Video studio: model picker, prompt, params, live cost, generate | The product. |
| 0.9 | Result viewer + download | Without this the loop doesn't close. |
| 0.10 | History with rerun | Second session retention. |

## Tier 1 — the win (ship if Tier 0 lands on schedule; these are why it's *better*)

| # | Item | Beats the original how |
|---|---|---|
| 1.1 | **Real progress state machine** over realtime, with honest per-stage labels | Replaces the fake 95% bar. Most-watched surface in the product. |
| 1.2 | **Parallel job tray** — fire N generations, watch them all, compare | Unlocks the actual value of a multi-model aggregator. The original can't do this. |
| 1.3 | **Model comparison run** — one prompt, 2–4 models, side by side | The killer demo for a walkthrough video, and the honest answer to "which model should I use?" |
| 1.4 | Image studio (all params) | Cheap to add once video works; images are fast and cheap to generate, which makes the live demo actually usable by strangers. |
| 1.5 | Prompt library + Enhance/Variation via Claude | Kills the blank-textarea problem. |
| 1.6 | **Public shareable permalink** per generation, with OG image | Closes the growth loop the original is missing. |
| 1.7 | Credits page as a real **ledger**, not a number | Trust. Every debit, credit, refund, with reason. |
| 1.8 | Stripe subscriptions + top-ups (test mode) with webhook-driven grants | Proves the money path end to end. |
| 1.9 | Auto-refund on failure, visible in the ledger | The original promises it in the FAQ; we show it. |
| 1.10 | **Limits engine + admin control plane** ([14](14-ADMIN-DASHBOARD.md)) | Per-client limits that are configurable, enforced at four points, clamped globally during incidents, and audited. The thing that makes a metered product operable by someone who isn't the person who wrote it. |

## Tier 2 — foundations laid, features deferred (schema + seams exist, UI doesn't)

These get **columns, tables, and interfaces** but not screens. That's the enterprise
foundation the brief asks for, without the time cost.

| Item | What exists after 12h | What's deferred |
|---|---|---|
| **Teams / workspaces** | `workspaces` table; every row keyed on `workspace_id`, not `user_id`; personal workspace auto-created on signup; RLS written against workspace membership | Invite flow, seat billing, role UI |
| **RBAC** | `workspace_members.role` enum (`owner\|admin\|member\|viewer`), authz helper reads it | Role-management UI |
| **Audit log** | `audit_events` table; every credit mutation and generation write emits one | Admin viewer |
| **API keys** | `api_keys` table (hashed), the public API routes are the same handlers the web app calls | Key-management UI, docs site |
| **Webhooks out** | Job state transitions already publish to an internal event bus | Subscriber registration + delivery/retry |
| **Multi-currency** | Prices stored `price_in_cents` + `currency`, per-market table seeded with the original's 9 price points | Locale-aware checkout UI |
| **i18n** | All UI copy in a single `en` message catalogue behind `t()`, `next-intl` wired | 5 more locales |
| **Watermarking** | `output_clean_path` + `output_delivery_path` columns, delivery gated on plan | Actual ffmpeg overlay job |
| **Rate limits** | Per-workspace token bucket in the API middleware | Per-key tiers |

## Tier 3 — deliberately not built

Each with the reason, because "what you left out" is scored.

| Cut | Reason |
|---|---|
| ~~**11 admin routes**~~ — **revised, see [14](14-ADMIN-DASHBOARD.md)** | Original call: ship one read-only `/admin` and stop. That was right for the *analytics* routes and wrong for the *control* routes — without a limits editor, the only lever on a customer is a database console and every intervention is an unlogged manual UPDATE. Revised: a policy/limits control plane plus three admin screens ship in Tier 1; the analytics routes (`/admin/revenue`, `/admin/costs`, `/admin/attribution`, `/admin/insights`) stay cut. |
| **Reposter program** (4 routes) | A UGC distribution program is a company-stage decision, not a product primitive. Replaced by shareable permalinks (1.6), which serve the same growth goal at 1% of the cost. |
| **Referrals** | Same family. Schema-compatible (`referred_by` column exists), UI deferred. |
| **Phone-OTP free trial** | Anti-abuse cost paid in activation. Replaced with: email-verified signup + a smaller grant (5 credits) + IP/device velocity limits + Turnstile. Same abuse surface, no phone wall. Explicit trade: slightly more abuse risk, materially better funnel — and for a demo where strangers must be able to use the live link, the phone wall is disqualifying. |
| **GA4 + TikTok pixel + PostHog** | Three analytics vendors on a 12h rebuild is theatre. One structured event stream to the DB (`analytics_events`), which is where they'd all read from anyway. |
| **6 locales / 11 currencies at runtime** | Ship `en` + USD. Everything is behind `t()` and `price_in_cents`, so adding them is data, not code. |
| **Marketing homepage with 40-image marquee** | We ship a landing page, but a lean one — hero, live gallery pulled from real generations, three-step explainer, pricing, CTA. The original's homepage is 200KB of HTML for a product whose value is behind a login. |
| **1080p / premium video tiers in the live demo** | Cost control. Model catalogue lists them; the live deployment caps to fast/cheap models under a hard spend ceiling. Stated openly in the UI, not hidden. |

---

## The demo constraint that shapes everything

> "The live link opens for somebody who is not signed in as you."

A stranger will open this link. Real video generation costs real money per click and
would be trivially drained. So the deployment ships three tiers of reality, chosen by
env var and visible in the UI:

1. **Real providers, capped.** Image generation and the cheapest fast video model run
   for real, behind a global daily spend ceiling and a per-workspace rate limit. When
   the ceiling is hit the app degrades to (2) rather than erroring.
2. **Mock provider.** Deterministic latency, real state machine, returns from a
   curated asset pool. Every pipeline stage, the ledger, refunds, realtime, and the
   result viewer are exercised identically. A reviewer with no account sees the whole
   loop work.
3. **Seeded gallery.** Public shareable generations exist from first load, so the
   landing page and share pages aren't empty for the first visitor.

The mock provider isn't a fallback bolted on at the end — it's Tier 0 item 0.6,
built *before* any real integration. It's what makes the pipeline testable in a
loop measured in milliseconds instead of minutes, and it's the difference between a
demo that works for a stranger at 11pm and one that 402s.

---

## Explicit success criteria

The build is "done" when a stranger can, on the live URL, without help:

1. Land, understand what it is in under ten seconds, and see real output.
2. Sign in with an email code in under 30 seconds.
3. Generate an image for real and download it.
4. Fire three video generations at once and watch three honest progress states.
5. Run the same prompt against two models and compare them side by side.
6. Open `/credits` and see exactly where every credit went, including a refund.
7. Share a generation via a public link that renders correctly in a Slack unfurl.
8. Come back tomorrow, open history, and rerun something.
