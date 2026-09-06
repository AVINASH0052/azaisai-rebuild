# 05 — API Contract

Two surfaces, **one set of handlers**:

- `/api/*` — session-cookie auth, called by our own app.
- `/api/v1/*` — bearer `api_key` auth, the public surface (Tier 2: keys exist, no
  management UI).

Both run through the same middleware chain and the same services. That's the point of
the layering in [03](03-ARCHITECTURE.md): there is no "internal" logic that the public
API reimplements.

## Conventions

- JSON in, JSON out. `Content-Type: application/json` required on writes.
- Every response carries `X-Request-Id`. It's in the logs, in Sentry, and shown in the
  UI on error so a user can quote it.
- Timestamps ISO-8601 UTC with `Z`.
- Money in integer minor units + explicit `currency`. Credits are plain integers.
- Cursor pagination — `?cursor=<opaque>&limit=<n≤100>` → `{ data, next_cursor }`.
  Never offset; history grows and offset pagination skips rows under concurrent writes.
- Mutating endpoints accept `Idempotency-Key`. Replaying one returns the original
  response with `X-Idempotent-Replay: true`. Non-negotiable for anything that spends
  money.

## Error envelope

```jsonc
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",   // stable, machine-readable, closed set
    "message": "You need 24 credits but have 6.",  // user-safe, shown verbatim
    "details": { "required": 24, "available": 6 },
    "request_id": "req_01J8..."
  }
}
```

| HTTP | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | Zod failure; `details.fields` maps field → message |
| 400 | `UNSUPPORTED_PARAM` | param not in the model's capability set (e.g. 1080p on Veo 3 Fast) |
| 401 | `UNAUTHENTICATED` | no/expired session or key |
| 403 | `FORBIDDEN` | authenticated, wrong workspace or insufficient role |
| 404 | `NOT_FOUND` | also returned instead of 403 for cross-workspace reads, so ids aren't enumerable |
| 409 | `IDEMPOTENCY_CONFLICT` | same key, different body |
| 402 | `INSUFFICIENT_CREDITS` | balance < quote |
| 422 | `CONTENT_POLICY` | provider or our pre-filter rejected the prompt |
| 429 | `RATE_LIMITED` | + `Retry-After` |
| 503 | `PROVIDER_UNAVAILABLE` | all adapters for that model down |
| 500 | `INTERNAL` | never leaks internals; `request_id` is the handle |

Errors are a closed TypeScript union shared with the client, so the studio can render
a *specific* recovery affordance per code — "Top up" for 402, "Try a different model"
for 503, "Rewrite prompt" for 422 — instead of a generic red toast. Small thing;
it's most of the difference between an app that feels solid and one that doesn't.

---

## Catalogue

### `GET /api/models`
Public, cached 5 min. The client never hardcodes a model list.
```jsonc
{ "models": [{
  "id": "veo-3-fast", "label": "Veo 3 Fast", "vendor": "google", "kind": "video",
  "badge": "fast", "credits": { "per": "second", "rate": 1.5 },
  "capabilities": { "audio": true, "imageToVideo": true,
                    "durations": [4,6,8], "aspects": ["16:9","9:16"],
                    "resolutions": ["720p"] },
  "estimatedSeconds": 35, "availability": "live" }] }
```

### `POST /api/generations/quote`
Cost preview without spending. Drives the live estimate above the Generate button.
Cheap, debounced, no side effects.
`{ modelId, params }` → `{ credits, breakdown: { rate, units, unit }, balanceAfter, sufficient }`

---

## Generation

### `POST /api/generations`
```jsonc
// request
{
  "kind": "video",
  "modelId": "veo-3-fast",
  "prompt": "A neon-lit city drone shot, slow cinematic movement",
  "negativePrompt": null,
  "params": { "aspect": "16:9", "durationSeconds": 8,
              "resolution": "720p", "audio": true },
  "sourceImagePath": null,
  "batchId": null            // set when this is one arm of a comparison run
}
// 202
{ "id": "...", "status": "queued", "creditsCharged": 12,
  "estimatedSeconds": 35, "balance": 43 }
```

Returns **202 immediately** — the provider call happens in the worker. The user's
click never waits on a third party. Order of operations inside the transaction is
exactly: validate params against capabilities → quote → lock workspace row → check
balance → write ledger debit → insert generation → insert outbox job → commit.

`POST /api/generations/batch` takes `{ prompt, params, modelIds: string[] }`, quotes
the sum, debits once, and fans out N generations sharing a `batch_id`. This is the
model-comparison feature; doing it as one atomic debit means a partial failure can't
leave the user half-charged for a comparison they never saw.

### `GET /api/generations/:id`
Full record. Used for polling fallback and `?rerun=` prefill.
```jsonc
{ "id": "...", "status": "processing", "stage": "Rendering frames",
  "progress": 0.42,               // null when genuinely unknown — we do not invent it
  "kind": "video", "modelId": "veo-3-fast", "prompt": "...",
  "params": {...}, "creditsCharged": 12, "creditsRefunded": 0,
  "assets": [{ "role":"output", "url":"<signed, 1h>", "mime":"video/mp4",
               "width":1280,"height":720,"durationMs":8000 }],
  "error": null, "shareId": null,
  "queuedAt":"...","startedAt":"...","completedAt":null }
```

**`progress` is nullable and we mean it.** When the provider reports real progress we
show it. When it doesn't, we show the *stage* and an indeterminate indicator — not a
fabricated percentage. This is the explicit correction of the original's 95% bar.

### `GET /api/generations` — history
Filters: `kind`, `status`, `modelId`, `batchId`, `q` (prompt full-text), `from`, `to`.
Cursor paginated.

### Other
- `DELETE /api/generations/:id` — soft delete. Assets purged by a nightly job.
- `POST /api/generations/:id/cancel` — only from `queued`/`submitted`; refunds in full.
- `POST /api/generations/:id/share` → `{ shareId, url }`; `DELETE` revokes.
- `GET /api/generations/:id/download?asset=output` — 302 to a short-lived signed URL,
  `Content-Disposition: attachment`. Increments a download counter. Gated on plan for
  watermark-free delivery.

---

## Prompt assistance

- `POST /api/prompt/enhance` → `{ prompt, kind, modelId }` → `{ enhanced }`.
  Claude rewrite, model-aware (a Veo prompt wants camera language; an image prompt
  wants composition and lighting). Streams. Rate limited hard — it's an LLM behind an
  unauthenticated-ish button.
- `POST /api/prompt/variate` → `{ variations: string[3] }`.
- `GET /api/prompt/presets?kind=video` → curated starting points by category.

---

## Credits & billing

| Endpoint | Returns |
|---|---|
| `GET /api/credits` | `{ balance, grants: [{kind, remaining, expiresAt}], plan, renewsAt }` |
| `GET /api/credits/ledger` | paginated ledger — `{ amount, reason, balanceAfter, generation:{id,thumbnail,prompt}, createdAt }` |
| `GET /api/billing/plans` | plans + packs, priced for the detected market |
| `POST /api/billing/checkout` | `{ productId, currency }` → `{ url }` Stripe Checkout |
| `POST /api/billing/portal` | `{ url }` Stripe Billing Portal — cancel/update handled by Stripe, not by us |
| `GET /api/billing/subscription` | current subscription state |

**There is no `POST /api/credits/deduct`.** The original exposes one; a client-callable
endpoint that decrements a balance is a hole, whatever the auth on it. Credits move
only as a side effect of a server-side action that consumes them, inside the same
transaction. Noted here because it's a deliberate divergence from the original's API.

---

## Webhooks (inbound)

### `POST /api/webhooks/stripe`
Signature-verified with `STRIPE_WEBHOOK_SECRET`. Raw body, no framework parsing.
Handles `checkout.session.completed`, `invoice.paid` (→ monthly credit grant),
`customer.subscription.updated/deleted`, `charge.dispute.created` (→ negative ledger
adjustment). Idempotent on `stripe_event_id` via a unique index — Stripe *will* deliver
twice, and a double credit grant is a real loss. Returns 200 fast, does work in a
transaction, and never trusts client-side success redirects for entitlement.

### `POST /api/webhooks/provider/:provider`
HMAC-verified. Maps to `ProviderStatus` via the adapter's `parseWebhook`. Idempotent on
`(provider, provider_job_id, state)`.

---

## Internal

`POST /api/internal/worker/tick` — Vercel Cron, guarded by `CRON_SECRET` + Vercel's
own signature header. Claims due outbox jobs with
`FOR UPDATE SKIP LOCKED LIMIT 10`, advances each. Overlapping invocations are safe by
construction — `SKIP LOCKED` is what makes concurrent workers correct instead of
merely unlikely to collide.

`POST /api/internal/reconcile` — hourly. Finds generations stuck non-terminal past
their SLA, re-polls the provider, and fails + refunds anything genuinely lost. This is
the safety net that makes "no user is ever silently charged for nothing" true even when
a webhook is dropped and a poll is missed.

## Rate limits

| Bucket | Limit |
|---|---|
| `generate` (per workspace) | 10/min, 60/hr; free plan 6/hr |
| `prompt/*` (per user) | 20/min |
| `auth/otp` (per email + per IP) | 5/hr |
| `api/v1/*` (per key) | 120/min |
| anonymous public reads | 300/min per IP |

Token bucket in Postgres for v1 (one table, one upsert — fine at this scale, and no
extra service to run); the interface is `RateLimiter` so swapping in Upstash Redis is
a one-file change when it stops being fine.
