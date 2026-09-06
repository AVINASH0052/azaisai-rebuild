# 12 — Architecture Decisions & Risk Register

## ADRs

Format: decision · alternatives rejected · consequence.

---

### ADR-001 — Next.js + Supabase + Vercel, same as the original

**Decision.** Match the original's stack rather than pick a "better" one.

**Rejected.** Remix/Hono + Neon + Fly; SvelteKit; a separate API service.

**Why.** Parity is the goal and the stack is already correct for it. Twelve hours is
not the window to pay a learning tax for a marginal framework preference. Supabase
bundles Postgres, Auth, Storage, Realtime, and RLS — four services we'd otherwise
provision separately, and Realtime specifically is what lets us delete the original's
polling.

**Consequence.** Vendor concentration on Supabase. Mitigated by keeping all data access
behind Drizzle and `services/` — Postgres is portable, and Realtime is the only piece
with real lock-in (~200 lines to replace with a websocket server).

---

### ADR-002 — Append-only credit ledger, not a balance column

**Decision.** `credit_ledger` is a journal. Balance is derived. No mutable
`credits int` anywhere.

**Rejected.** `workspaces.credits` with atomic increments — simpler, one column.

**Why.** The product makes three promises that are *temporal* questions about money:
refunds on failure, monthly credits that don't roll over, and packs that expire in 12
months. A mutable integer answers none of them, and the first "where did my credits
go?" ticket is unanswerable. The ledger also makes the credits page a trust surface
instead of a number.

**Consequence.** ~40 more lines and a `balance_after` denormalisation to keep reads
O(1). A no-UPDATE/no-DELETE trigger enforces immutability, so corrections must be
compensating rows — which is the point.

---

### ADR-003 — Debit on submit, refund on failure

**Decision.** Credits are taken in the same transaction that creates the generation.

**Rejected.** Charge on success; reserve-then-capture (two-phase hold).

**Why.** Charge-on-success loses the concurrency property: ten simultaneous submits
against a 6-credit balance all pass the check and all run. Reserve-then-capture is
correct but adds a hold state, an expiry sweeper, and a second failure mode, for no
user-visible benefit over debit-and-refund.

**Consequence.** The refund path is load-bearing, so it's transactional with the
failure write, idempotent on `refund:<generation_id>`, and backstopped by an hourly
reconciler.

---

### ADR-004 — Transactional outbox + cron worker, no message broker

**Decision.** `job_outbox` table, claimed with `FOR UPDATE SKIP LOCKED`, driven by
Vercel Cron and provider webhooks.

**Rejected.** Inngest / QStash / Trigger.dev (another vendor, another key, another
failure mode); Vercel `waitUntil` alone (dies with the function; no retry, no
durability).

**Why.** The job is inserted in the same commit as the credit debit and the generation
row, so the three can never disagree. `SKIP LOCKED` makes concurrent workers correct
by construction rather than unlikely to collide. Zero new infrastructure.

**Consequence.** Up to ~10s of scheduling latency on the cron path — invisible next to
a 35–180s generation, and webhooks cover the fast path anyway. If throughput outgrows
this, the outbox is exactly the right shape to put a real queue in front of.

---

### ADR-005 — fal.ai as the primary provider, behind an adapter

**Decision.** One aggregator key covering Veo, Sora-class, Runway-class, nano-banana
and flux, behind a `ModelProvider` interface.

**Rejected.** Direct OpenAI + Google Vertex + Runway keys (three onboardings, three
billing relationships, three quota regimes — days, not hours); Replicate (similar,
slightly worse video coverage).

**Why.** Time. The adapter interface means this is a swap, not a rewrite: adding a
direct vendor later is one file plus a registry edit, and the registry already supports
multiple `providerModel` candidates per logical model for failover.

**Consequence.** A margin haircut versus direct vendor pricing, and dependence on one
aggregator's uptime. Both acceptable at demo scale; the failover path and the mock
fallback cover the uptime risk.

---

### ADR-006 — Build the mock provider first

**Decision.** `providers/mock` is Tier 0, written before any real integration.

**Rejected.** Integrate fal.ai first, add fixtures later.

**Why.** Three payoffs, each independently sufficient. (1) The live demo works for a
stranger regardless of keys, quota, or spend — and "the live link opens for somebody
who is not signed in as you" is a hard requirement. (2) The pipeline becomes testable
in milliseconds instead of minutes, which is most of the schedule. (3) The failure and
refund path is demoable on demand instead of only when a provider happens to reject
something.

**Consequence.** An hour spent on code that ships no user-facing feature. It buys back
several.

---

### ADR-007 — Stripe, entitlement granted by webhook only

**Decision.** Stripe Checkout + Billing Portal. Credits are granted on
`invoice.paid` / `checkout.session.completed`, never on the success redirect.

**Rejected.** Paddle/LemonSqueezy (merchant of record handles VAT — genuinely better
for a real SaaS selling into the EU, worse for a 12-hour build: slower onboarding,
worse test tooling). Trusting the success redirect (a replayable URL that grants
credits is a hole).

**Consequence.** We'd owe VAT handling in a real launch. Noted, not built. Billing
Portal removes an entire cancellation/invoice UI from scope.

---

### ADR-008 — Workspace-scoped everything from commit one

**Decision.** Every tenant row carries `workspace_id`. RLS is written against
workspace membership. No UI mentions workspaces in v1.

**Rejected.** `user_id` everywhere, add teams later.

**Why.** This is the cheapest thing in the whole plan to do now (one column, one
membership table) and among the most expensive to retrofit — a data migration plus a
rewrite of every RLS policy and every query, on live data. It is the clearest concrete
answer to "solid foundation so it can always be scalable."

**Consequence.** Slightly more verbose queries in v1. That's the entire cost.

---

### ADR-009 — Honest progress instead of a simulated bar

**Decision.** `Progress` is a three-variant union: determinate (real number from the
provider), staged (phase + ETA from that model's rolling p50), indeterminate. Never a
fabricated percentage.

**Rejected.** The original's decelerating bar capped at 95%.

**Why.** It's the most-watched surface in the product. A bar that stalls at 95% for
ninety seconds teaches users the UI is lying, which poisons every other signal it
gives them — including the credit counter. Stage labels plus a real ETA are both more
informative and cheaper to compute.

**Consequence.** Requires real state from the pipeline, which is why `downloading` is a
first-class status. More engineering than a `setInterval`. It's the difference the
walkthrough is built around.

---

### ADR-010 — Drop the phone-verification wall

**Decision.** Email verification + Turnstile + velocity limits + a smaller (5-credit)
grant, instead of phone OTP.

**Rejected.** Keeping phone verification (strictly better anti-abuse).

**Why.** The brief requires a live link a stranger can use. A phone wall in front of
the first output is disqualifying for that, and it's a heavy activation tax generally.
The layered replacement pushes the marginal value of a farmed account below the
marginal effort.

**Consequence.** Higher abuse tolerance, accepted explicitly. Backstopped by the daily
spend ceiling, which makes the worst case bounded in dollars rather than open-ended.

---

### ADR-011 — One analytics table, not three vendors

**Decision.** `analytics_events` in Postgres. No GA4, no TikTok pixel, no PostHog.

**Why.** Three marketing vendors on a 12-hour rebuild is theatre, and they'd all be
reading events we have to define anyway. A side benefit: with no third-party marketing
cookies there is no consent banner, which is a real UX improvement that falls out of a
scope decision.

**Consequence.** No attribution for paid acquisition. That's a company-stage need, and
the event stream is the right substrate to feed it later.

---

### ADR-012 — A resolved policy object, not limit columns

**Decision.** Every limit in the product is a field on one `EffectivePolicy`, resolved
per workspace per request by layering platform defaults → plan policy → workspace
override, then clamping against global ceilings. Four enforcement points read it and
nothing else reads a limit. ([14](14-ADMIN-DASHBOARD.md))

**Rejected.** Limit columns on `workspaces` (`max_concurrent`, `can_use_premium`,
`is_suspended`) — simpler, obvious, and what most products do first.

**Why.** Columns work until limits need to vary by plan *and* by customer *and*
globally during an incident. At that point the checks are scattered, they disagree, and
nobody can answer "why is this customer throttled?" The `source` map on the resolved
object answers that question by construction. The clamp step (rather than a plain
merge) is what makes an incident-time global ceiling actually win over a per-customer
override.

**Consequence.** More machinery than three columns: a resolver, a cache with version
invalidation, and a preview-diff in the admin UI because the effect of an edit isn't
obvious from the edit. Roughly 75 minutes, taken from the prompt-enhance and Stripe
slots.

---

### ADR-013 — Platform admin is a separate authz plane

**Decision.** `platform_admins` is its own table with its own roles, never derived from
`workspace_members`.

**Rejected.** An `admin` value on the existing workspace role enum.

**Why.** Every user is the owner of their own personal workspace ([ADR-008](#adr-008--workspace-scoped-everything-from-commit-one)).
If platform admin were a workspace role, the distance between "owner of my own
workspace" and "operator of the platform" is one mistaken `WHERE` clause. Separate
table, separate function, separate RLS, no derivation.

**Consequence.** A second authz path to maintain and test. Worth it — this is the
failure mode that turns a bug into a breach.

---

## Risk register

| # | Risk | L | I | Mitigation | Trigger → action |
|---|---|---|---|---|---|
| R1 | Provider API keys unobtainable or rate-limited in time | M | H | Mock provider is Tier 0 and the demo works without any key | No key by H8 → ship mock-only, say so in the walkthrough |
| R2 | Video generation cost runs away on a public link | M | H | Daily spend ceiling in code; free tier capped at 3 live/day; video limited to the fast tier; degrade to mock, don't error | 80% of cap → alert; 100% → auto-degrade |
| R3 | Pipeline (H4–H6) overruns and eats the studio | M | H | It's on the critical path and scheduled first; the mock makes it testable in ms; the cut list is pre-decided | Not done by H6.5 → cut image studio and Stripe immediately |
| R4 | Vercel serverless 60s limit kills a long artifact download | M | M | Streamed copy, not buffered; 90s lease means a killed worker's job is retried, not lost | Recurring → move download to a separate fn with `maxDuration=300` |
| R5 | Supabase Realtime flaky under load | L | M | Client falls back to polling on disconnect with a "Reconnecting" chip; the row is always the source of truth | Disconnect rate > 5% → polling default |
| R6 | Capture hook silently stops mid-build | L | **H** | Script never truncates and never blocks; writes `.capture-errors.log`; entry count verified at every commit checkpoint | Gap in the log → note it honestly in `CAPTURE-TEST.md`, do not backfill |
| R7 | Secret leaked into `.agent-logs/` (which is public and unedited) | L | H | Working rule: secrets never enter a prompt; set via `vercel env add` and the dashboard. Pre-submission scan. Rotate anything suspect. | Any hit → rotate the key, disclose in the README |
| R8 | RLS misconfigured → cross-workspace data leak | L | H | RLS + service-layer authz (defence in depth); an integration test asserts A can't read B; `pg_policies` verified by query at H10.5 | Any test failure blocks submission |
| R9 | Stripe webhook double-delivery → double credit grant | M | M | Unique index on `stripe_event_id`; replay test in CI | — |
| R10 | Scope creep from the original's 11 admin routes / reposter program | M | M | Tier 3 cuts are written down here, before the build starts | Any Tier 3 item starts → stop, re-read [02](02-SCOPE.md) |
| R11 | Localhost works, production build fails at hour 11 | M | H | Deploy at H1; every commit deploys; production `/api/health` checked at each checkpoint | Red health → fix before continuing |
| R12 | Walkthrough runs over 5 minutes | H | M | Scripted to 4:30 with timed beats; rehearsed once; the E2E test is the script | Over on take 1 → cut the architecture beat to 15s |
| R13 | Authenticated flows of the original never observed, so a detail is wrong | M | L | Structure derived from the shipped bundle (high confidence on contracts); the seven open questions in [01](01-PRODUCT-TEARDOWN.md) §8 don't gate anything | Demo account provided → 10-min pass, adjust history/credits screens |
| R14 | Admin control plane (+75 min) pushes the schedule past 12h | **H** | M | Cut order re-ranked so admin Tier A outranks prompt-enhance and Stripe; Tier B/C explicitly deferred; the H11–H12 buffer is knowingly spent ([11](11-DELIVERY-PLAN.md)) | Behind at H6.5 → fire cuts 1 and 2 immediately, not at H10 |
| R15 | A limits bug locks legitimate users out of a live demo | M | H | Every limit fails **open** on resolver error (log + platform defaults, never deny); integration test asserts a resolver exception still permits a free-plan generation; global clamps are one DB row to release | Any lockout report → release the clamp first, diagnose second |
| R16 | An admin mis-set makes a customer's state unexplainable | L | M | `source` map on the resolved policy, required `reason` on every override, `before`/`after` diff on every `admin_actions` row, `expires_at` on overrides so temporary stays temporary | — |

## Assumptions

Stated so they can be corrected rather than discovered:

1. A rebuild means functional and experiential parity plus improvement — not a
   pixel-identical clone, and not copying their trademarks or their marketing copy.
2. Test-mode payments are acceptable for the live demo. Real card capture on a
   12-hour build would be irresponsible.
3. Provider model names are used descriptively (as the original does). We're not
   claiming a partnership.
4. The reviewer will open the live link signed out, so seeded public content and the
   mock provider are load-bearing, not decoration.
5. Generated content stays private by default; sharing is explicit and revocable.
