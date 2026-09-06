# 10 — Observability & Operations

Scaled to a 12-hour build: everything here is either free, one line, or genuinely
needed to debug the pipeline live during a walkthrough. Nothing is dashboard theatre.

## Logging

Structured JSON via `pino`. One logger, bound with request context in middleware.

```ts
log.info({
  event: "generation.completed",
  request_id, workspace_id, generation_id,
  model_id: "veo-3-fast", provider: "fal",
  duration_ms: 34210, credits: 12, provider_cost_cents: 18,
}, "generation completed");
```

Rules:
- `event` is a dotted, stable name from a closed list. Grep-able, aggregatable.
- **Never log**: prompts in full (truncated to 120 chars + a hash), emails (hashed),
  any key, any signed URL.
- `request_id` on every line, returned in `X-Request-Id`, shown in the UI on error.
  One id ties a user's complaint to the exact log line.
- Levels: `error` = paged, `warn` = looked at, `info` = business events, `debug` = local.

Vercel captures stdout. For a 12-hour build that's sufficient; a log drain to Axiom is
one env var when it isn't.

## Metrics

Derived from the DB, not a separate TSDB — the data is already there and correct.

| Metric | Query source | Why |
|---|---|---|
| Generation success rate (by model, 24h) | `generations` | The single health number |
| p50/p95 duration by model | `started_at`→`completed_at` | Feeds the honest ETA in the UI |
| Queue depth & oldest waiting job | `job_outbox` | Worker falling behind |
| Refund rate | `credit_ledger` | Provider quality regression |
| Credits sold vs `provider_cost_cents` | join | Margin |
| Daily spend vs cap | `generations` | Cost guardrail |
| Signup → first generation conversion | `analytics_events` | Activation |

These are the `/admin` page ([08](08-DESIGN-UX.md)), which is deliberately the same
thing as the metrics dashboard. Two systems computing the same number will disagree.

## Tracing

Sentry for errors + performance. Traced spans that matter:
`api.generations.create` → `credits.debit` → `db.tx` ; and in the worker,
`worker.advance` → `provider.submit` → `provider.poll` → `storage.download` →
`storage.upload`. `generation_id` and `model_id` as span attributes, so a slow model
is visible without a query.

Sentry `beforeSend` strips prompt text and any URL query strings.

## Alerts

Four. More than that and none get read.

| Alert | Condition | Action |
|---|---|---|
| Pipeline stalled | oldest `job_outbox.run_after` > 5 min | worker/cron broken |
| Failure spike | success rate < 80% over 15 min, ≥10 jobs | provider incident → flip to mock |
| Spend ceiling | daily spend > 80% of cap | throttle or top up |
| Webhook failures | any Stripe webhook 5xx | entitlement at risk |

## Health

`GET /api/health` → `{ status, checks: { db, storage, provider, stripe }, version }`.
`version` is the git SHA, injected at build. Also rendered in the app footer, so
"which build is live" is never a question.

## CI/CD

GitHub Actions on every push:

```
typecheck  →  lint  →  unit (vitest)  →  build  →  e2e (playwright, mock provider)
                                                  →  axe a11y on 5 routes
                                                  →  pnpm audit
```

Vercel: preview deploy per branch (own Supabase project, Stripe test, `PROVIDER_MODE=mock`),
production on `main`. Migrations run in a pre-deploy step against a scratch branch DB
first; a failing migration blocks the deploy rather than half-applying.

**Deploy on hour 1, not hour 11.** The most common way to fail this assignment is a
working localhost app and a broken production build discovered at hour 11. The
skeleton ships to the live domain before the second feature is written, and every
commit after that is a deploy.

## Testing strategy

Proportionate. Not 90% coverage; coverage where being wrong costs money or a demo.

| Layer | What | Why |
|---|---|---|
| Unit | `credits.*` — debit under concurrency, refund idempotency, spend order, expiry, `balance_after` continuity | This is the money. Wrong here is unrecoverable. |
| Unit | pricing quotes per model, capability validation | Cheap, catches registry typos |
| Integration | full pipeline against the mock provider: submit → advance → ready; and submit → fail → refund | Runs in ms because the provider is mock. This is the payoff for building mock first. |
| Integration | RLS: workspace A cannot read workspace B, anon can read only public | Security assertion, not a hope |
| Integration | Stripe webhook idempotency with a replayed event | Double-grant is a cash loss |
| E2E (Playwright) | sign in → generate → ready → download → history → rerun → share | The loop. If this passes, the product works. |
| a11y | axe on landing, auth, studio, history, credits | AA gate |

The E2E happy path doubles as the walkthrough script.

## Runbooks

**Provider down / failure spike** → set `PROVIDER_MODE=mock` in Vercel, redeploy
(~40s). App stays fully functional, badge says outputs are samples. Reconciler refunds
in-flight jobs automatically.

**Jobs stuck in `queued`** → check `/api/health`, then Vercel cron logs. Manually
`POST /api/internal/worker/tick` with the secret. Leases expire in 90s, so nothing is
permanently wedged.

**A user says they were charged for a failure** → look up the generation id, read the
ledger rows for it. If `credits_refunded = 0` on a terminal failure the reconciler
missed it; re-run `credits.refund(generationId)` — idempotent, safe to run twice.

**Spend cap hit** → app self-degrades to mock with a visible badge. Decide: raise cap
or leave degraded. No code change either way.

**Bad deploy** → Vercel instant rollback to the previous deployment. Migrations are
forward-only and additive, so a rollback never leaves the schema ahead of the code in
a breaking way.

## Cost model at demo scale

| Service | Plan | Cost |
|---|---|---|
| Vercel | Hobby/Pro | $0–20 |
| Supabase | Free/Pro | $0–25 |
| fal.ai | pay-as-you-go, capped | budgeted ~$20 for the demo window |
| Stripe | test mode | $0 |
| Anthropic (enhance) | pay-as-you-go | < $1 |
| Sentry | free tier | $0 |

Hard ceiling enforced in code by `DAILY_SPEND_CAP_CENTS`, not by watching a dashboard.
