# 17 — Backend Services

## The honest starting point

There *is* a backend in the plan — route handlers in `app/api/*` calling a `services/`
layer, over Postgres. What there isn't is a **separately deployed, always-on backend
process**, and that distinction matters in exactly one place, which this doc fixes.

Worth saying plainly: [03](03-ARCHITECTURE.md) already put the business logic in
`services/`, explicitly "pure of HTTP and of React," with a rule that route handlers
may not import from `db/`. That wasn't decoration. It means extracting a standalone
backend is a **move**, not a rewrite — the transaction boundaries, the credit ledger,
the provider adapters, and the generation state machine all relocate unchanged.

So the question isn't "do we need a backend." It's **which parts genuinely need to stop
being serverless**, and the answer is narrower than it first looks.

## Where serverless actually hurts

Ranked by how much it costs us, not by how it sounds:

| # | Problem | Severity |
|---|---|---|
| 1 | **Vercel functions cap at 60s** (300s on Pro). Downloading a 25MB MP4 from a provider, probing it, thumbnailing it, and uploading it to Storage is real work that can exceed that. This is **R4** in the risk register — already flagged as a known weakness. | **High** |
| 2 | **Cron granularity.** A 10s cron tick is the floor. A persistent worker consumes jobs the instant they're enqueued, and holds real concurrency (N workers × M jobs) instead of "whatever fits in one invocation." | High |
| 3 | **Connection exhaustion.** Every serverless invocation wants a Postgres connection. At any real concurrency this exhausts the pool without a pooler in front. | Medium |
| 4 | **Webhook endpoint stability.** Provider and Stripe webhooks want a stable, always-warm URL. Cold starts on a signature-verified webhook are a retry storm waiting to happen. | Medium |
| 5 | **Cost shape.** Long-poll-and-wait is the worst possible serverless workload — you pay for wall-clock time spent doing nothing. | Medium |
| 6 | Public API scaling independently of the web app | Low (at our size) |

Note what's *not* on this list: request/response API handling. Serverless is genuinely
good at that, and moving `POST /api/generations` into a separate service would add a
network hop for no benefit. **The pipeline is the part that needs to leave.**

---

## Target architecture

A **pnpm workspace monorepo** — three deployable apps, five shared packages.

```
azai/
├── apps/
│   ├── web/          Next.js on Vercel — UI, RSC, auth, BFF route handlers
│   ├── api/          Fastify, always-on — public /v1 API, webhooks, admin API
│   └── worker/       Node, always-on — generation pipeline, queue, cron jobs
└── packages/
    ├── core/         services: generation · credits · billing · policy · workspace
    ├── db/           Drizzle schema + migrations + typed queries
    ├── providers/    ModelProvider adapters: fal · mock
    ├── contracts/    Zod schemas, shared error union, generated OpenAPI types
    └── config/       env validation, logger, tracing, constants
```

**`packages/core` is the actual backend.** The three apps are transports over it. That
framing keeps the important property: there is exactly one implementation of "debit
credits and create a generation," and the web app, the public API, and the worker all
call the same function with the same transaction semantics. Three services that each
reimplement credit logic is how ledgers drift.

### Responsibilities

| App | Owns | Deployed | Scale trigger |
|---|---|---|---|
| `web` | RSC pages, auth callback + role routing ([16](16-AUTH-AND-ROUTING.md)), BFF handlers for our own UI | Vercel | page traffic |
| `api` | `/v1` public API, Stripe + provider webhooks, admin API | Railway | external API traffic |
| `worker` | queue consumers, provider submit/poll, artifact download → Storage, reconciler, credit expiry, cleanup | Railway | queue depth |

**`web` calls `packages/core` directly, in-process.** It does not proxy through `api`.
Adding a network hop between the browser's request and the database, for a request the
web app is already authenticated for, buys nothing but latency and a second failure
mode. `api` exists for consumers that aren't our UI — external API keys, and webhook
senders that need an always-warm signature-verified endpoint.

### Stack

| Choice | Why | Rejected |
|---|---|---|
| **pnpm workspaces** | Native, fast, strict about phantom deps. No extra build orchestration for 3 apps. | Turborepo (worth it at ~10 packages, overhead at 5); Nx (heavier still) |
| **Fastify** for `api` | Fastest Node HTTP framework, first-class TS, schema validation built in, clean plugin model. ~200 lines to stand up. | Express (slower, weaker types, needs 6 middlewares for what Fastify does natively). **NestJS** — genuinely better for a large team: DI, modules, decorators, enforced structure. Wrong here: heavier, slower to build, and its main benefit (imposed structure) is already provided by `packages/core`. |
| **pg-boss** for the queue | Postgres-backed, so **no Redis to run**. Gives retries, exponential backoff, scheduling, dead-letter, and singleton jobs natively. Critically, it consumes from the same Postgres the transactional outbox writes to — so the outbox stays atomic with the credit debit. | BullMQ + Redis (faster, richer, but a second datastore to run, back up, and keep consistent with Postgres — and job/DB atomicity is lost) |
| **Railway** for `api` + `worker` | Persistent processes, deploy from the same repo, ~40s deploys, cheap, region-pinnable next to Supabase. | Fly.io (excellent, more config); Render (fine, slower deploys); ECS/K8s (absurd at this size) |

## The queue, corrected

[06](06-GENERATION-PIPELINE.md) designed a hand-rolled outbox with
`FOR UPDATE SKIP LOCKED` claiming and a lease. That was the right design *given
serverless*. With a persistent worker, pg-boss is that same pattern already built,
tested, and handling the edge cases — so we keep the outbox insert (it's what makes the
job atomic with the credit debit) and let pg-boss own claiming, retry, and backoff.

```
BEGIN;
  credit debit  →  insert generations  →  pgboss.send('generation.advance', {id})
COMMIT;                                    ↑ participates in the same transaction
```

What the persistent worker adds beyond that:

- **No timeout.** The artifact download completes regardless of size. R4 closed.
- **Real concurrency**, tuned per job type: 20 concurrent polls (IO-bound, cheap),
  4 concurrent downloads (bandwidth/memory-bound).
- **Graceful shutdown** — SIGTERM stops intake, finishes in-flight jobs, then exits.
  A deploy mid-generation doesn't strand a user's video.
- **Cron in-process** — reconciler hourly, credit expiry nightly, soft-delete purge
  daily. No `vercel.json` cron, no `CRON_SECRET` endpoint to protect.
- **Persistent connection pool** — no per-invocation connection churn.

## Auth between services

| Path | Mechanism |
|---|---|
| browser → `web` | Supabase session cookie (httpOnly) |
| browser/client → `api` | Supabase JWT as bearer, verified against Supabase's **JWKS** — asymmetric, so no shared secret is distributed |
| external → `api /v1` | `api_keys` bearer, argon2id hash compare, scopes checked |
| webhooks → `api` | Stripe signature / provider HMAC on the **raw body** |
| `web` → `api` (rare) | service token, mTLS-equivalent via a shared secret header on a private network |
| `worker` | **no inbound surface at all** — it is not exposed to the internet. Consumes the queue, calls out to providers. |

The worker having no HTTP listener is a meaningful security property: the component
with the widest database privileges is unreachable from outside.

## Connection pooling

- `web` (serverless, many short-lived connections) → **Supavisor in transaction mode**.
  Non-negotiable; without it, concurrent Vercel invocations exhaust Postgres.
- `api` / `worker` (persistent) → direct connection with a normal pool (max 10 each).
  Transaction-mode pooling breaks prepared statements and advisory locks, and the
  worker needs both.

Two different connection strategies for two different runtime shapes, from one
`packages/db` that takes the mode as config.

## Deployment topology

```
                    ┌──────────────────────────────────────┐
  Browser ──────────► Vercel Edge → apps/web (Next.js)      │
      │              └───────────────┬──────────────────────┘
      │                              │ packages/core (in-process)
      │  bearer JWT                  ▼
      └──────────► Railway: apps/api ──────► Supabase Postgres (Supavisor)
                        ▲                           ▲
   Stripe ──────────────┤                           │ direct pool
   Provider webhooks ───┘                           │
                                                    │
                   Railway: apps/worker ────────────┘
                        │  pg-boss consumer + cron
                        ├──► fal.ai  (submit / poll)
                        └──► Supabase Storage (artifact copy)
```

One Postgres. One Storage bucket set. Three processes, all speaking the same
`packages/core`.

## Observability across services

- `request_id` generated at the edge, propagated as `x-request-id` through `api` and
  onto the queue payload, so a single id traces browser → API → worker → provider.
- **OpenTelemetry** trace context propagated the same way, so one Sentry trace spans
  all three processes. A slow generation shows *which* hop was slow.
- One `packages/config` logger — same JSON shape, same redaction rules, three services.
- `/health` on both `api` and `worker` (the worker exposes health on a private port
  only), reporting queue depth and oldest job age. Extends [10](10-OBSERVABILITY-OPS.md).

---

## Phasing — and the one cheap decision that matters

The full three-app split does **not** fit in the remaining window. But one piece of it
is nearly free *if done early* and expensive if done late:

### The H1 decision: lay out the monorepo from the start

Converting to a pnpm workspace at H1, when there are ~20 files, costs **~15 minutes**.
Doing it at H10, across ~200 files with hundreds of imports, costs well over an hour
and risks breaking a working build near the deadline.

So: **`apps/web` + `packages/*` from the first commit**, even though `apps/api` and
`apps/worker` are empty directories for most of the build. All business logic goes into
`packages/core` from the start, exactly as [03](03-ARCHITECTURE.md) already requires.

That makes every later extraction a folder move plus a `package.json`.

### Phase 1 — extract the worker (~75 min) — **recommended, if the schedule holds**

Highest value per minute, because it closes R4, which is a real correctness risk on
large artifacts rather than an aesthetic concern.

- [ ] `apps/worker` — pg-boss consumer over the existing outbox
- [ ] Move artifact download / probe / thumbnail out of the serverless path
- [ ] Reconciler + credit expiry + purge as in-process cron
- [ ] Deploy to Railway; remove the Vercel cron and `CRON_SECRET` endpoint
- [ ] Graceful shutdown on SIGTERM

Scheduled at **H12.75–H14** — i.e. *after* everything submission-critical. If the
window runs out here, the app is complete and shipped; the worker is an improvement
that didn't land, not a hole.

### Phase 2 — extract `apps/api` (post-submission)

Public `/v1`, webhooks, admin API on Fastify. Deferred because it adds two deploy
targets and a network hop for benefits (independent API scaling, always-warm webhooks)
that don't show up at demo scale or in a five-minute walkthrough.

### Phase 3 — what we deliberately will not do

**Microservices.** Not a generation service, a billing service, and a user service
talking over a network. At this size that trades one clear transaction boundary — the
credit debit and the generation insert in a single commit — for a distributed
transaction and a saga. That's a downgrade in correctness, sold as an upgrade in
architecture.

A modular monolith plus a dedicated worker scales to a very large number of users. The
seam that would matter first is the generation pipeline, and Phase 1 already cuts it.

## Delivery impact and the honest schedule

| | Cost | Where |
|---|---|---|
| Monorepo layout | +15 min | H0.5–H1.5, **do it** |
| Worker extraction (Phase 1) | +75 min | H12.75–H14, after submission-critical work |

The nominal schedule was already at H12.75 after the admin control plane
([14](14-ADMIN-DASHBOARD.md)). Phase 1 takes it to ~H14. Stated plainly rather than
buried: **that is over the 12-hour window**, and the resolution is the cut order in
[11](11-DELIVERY-PLAN.md), not optimism.

**My recommendation:** take the monorepo layout (15 min, high leverage, low risk),
treat Phase 1 as the first thing to do *if* the earlier phases run ahead, and let
Phase 2 be post-submission. The brief scores speed, product judgement, and UX — a
second deployed service adds nothing to any of those on its own. What it adds is the
answer to "does this survive contact with month six," and the monorepo layout plus
`packages/core` is 80% of that answer for 15 minutes of work.
