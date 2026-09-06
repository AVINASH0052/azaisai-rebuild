# 06 — Generation Pipeline

The hard part. Everything else is CRUD.

## The problem

A generation is a distributed transaction across four systems that can each fail
independently: our DB (credits), a third-party GPU provider (30s–3min, sometimes
never), object storage (a 20MB download+upload), and the user's browser (which may
close mid-job). Money moves before the work completes. Get this wrong and users are
either charged for nothing or generate for free.

Three properties we need, in priority order:

1. **No user is ever charged for output they didn't get.** (The FAQ promises it.)
2. **No generation runs that wasn't paid for.** (Including under concurrency.)
3. **Every job reaches a terminal state**, even if a webhook is dropped, the worker
   crashes mid-flight, or the provider silently abandons it.

## Design

### Debit on submit, refund on failure

The alternative — charge on success — loses property 2: ten concurrent submits on a
6-credit balance all pass the check and all run. Debiting first, inside the same
transaction that creates the generation and takes a row lock, makes overspending
impossible. Refunding on non-billable failure restores property 1.

### Transactional outbox

```sql
BEGIN;
  SELECT balance FROM workspaces WHERE id = $ws FOR UPDATE;   -- serialise this ws
  INSERT INTO credit_ledger (...) VALUES (..., -12, 'generation_debit', ...);
  INSERT INTO generations   (...) VALUES (..., 'queued', ...);
  INSERT INTO job_outbox    (generation_id, run_after) VALUES ($gen, now());
COMMIT;
```

One commit. A generation cannot exist without its job, a job cannot exist for a
rolled-back generation, and credits cannot be taken without both. No message broker
to keep consistent with the database, because the queue *is* the database.

### Two drivers, one advance function

- **Webhooks** — the fast path. Provider calls us the moment state changes.
- **Cron polling** — every 10s, the safety net. Claims due jobs, polls, advances.

Both call the same idempotent `generationService.advance(id)`. A webhook arriving
during a poll is safe: `advance` re-reads state inside a transaction and no-ops on a
stale transition. State transitions are guarded by
`UPDATE generations SET status=$new WHERE id=$id AND status=$expected` — if the row
already moved on, zero rows update and we stop. Compare-and-swap, not read-then-write.

### Worker claim

```sql
UPDATE job_outbox SET locked_until = now() + interval '90 seconds',
                      locked_by = $workerId, attempts = attempts + 1
WHERE id IN (
  SELECT id FROM job_outbox
  WHERE run_after <= now() AND (locked_until IS NULL OR locked_until < now())
  ORDER BY run_after
  FOR UPDATE SKIP LOCKED
  LIMIT 10
) RETURNING *;
```

`SKIP LOCKED` is what lets overlapping cron invocations run concurrently without
double-processing. `locked_until` is a lease, so a worker killed mid-job (Vercel
function timeout at 60s) releases its work automatically after 90s.

---

## Lifecycle, stage by stage

| Status | What happens | User sees |
|---|---|---|
| `queued` | row committed, credits taken, awaiting worker pickup | "Queued" + position if >1 |
| `submitted` | adapter `submit()` returned a `provider_job_id` | "Sent to Veo 3 Fast" |
| `processing` | provider working; `stage` from vendor if given | vendor stage, or "Generating" |
| `downloading` | streaming artifact from provider → Supabase Storage; probing dimensions; extracting a thumbnail frame | "Downloading your video" + real byte progress |
| `ready` | assets rows written, row updated → Realtime fires | result appears |
| `failed` | terminal after retries; refund if `billable:false` | specific error + recovery action |

### Why `downloading` is a visible state

It's real work with a real duration and a real byte count. Showing it instead of
folding it into a fake percentage means the last few seconds of the wait — the part
users stare at hardest — is the *most* honest part of the UI rather than the least.

### Progress, honestly

```ts
type Progress =
  | { kind: "determinate"; value: number; stage: string }   // provider gave us a number
  | { kind: "staged"; stage: string; etaSeconds: number }   // we know the phase + a historical ETA
  | { kind: "indeterminate"; stage: string };               // we genuinely don't know
```

Three renderings: a real bar, a stage stepper with a live-updating ETA derived from
the p50 of the last 100 completions **for that model** (not a hardcoded guess), and a
shimmer. What we never render is a number we made up. When the ETA is exceeded the
copy changes to "Taking longer than usual — still working" rather than freezing at
95%, which is the specific failure mode of the original.

---

## Retries and failure taxonomy

```ts
type FailureCode =
  | "content_policy"    // user's fault, deterministic  → no retry, refund
  | "invalid_input"     // our/user's fault             → no retry, refund
  | "provider_error"    // transient                    → retry ×3, then refund
  | "timeout"           // transient                    → retry ×2, then refund
  | "quota_exceeded"    // our account                  → retry with backoff, then fail over
  | "cancelled"                                          // → refund
```

Backoff: 5s, 20s, 60s + jitter, via `run_after`. Retries reuse the same generation row
and the same `idempotency_key`, so a retry after an ambiguous timeout can't create a
second provider job that we pay for twice.

**Refund is transactional with the failure write:**

```sql
BEGIN;
  UPDATE generations SET status='failed', error_code=$code, completed_at=now()
   WHERE id=$id AND status <> 'failed';       -- CAS: 0 rows means someone beat us
  -- only if that updated a row:
  INSERT INTO credit_ledger (..., +12, 'generation_refund', generation_id=$id)
   ON CONFLICT (idempotency_key) DO NOTHING;  -- key = 'refund:'||$id
  UPDATE generations SET credits_refunded = credits_charged WHERE id=$id;
COMMIT;
```

The CAS guard plus the unique idempotency key mean a duplicate webhook, a racing cron
tick, and a manual admin retry all converge on exactly one refund.

### `quota_exceeded` → failover

The registry allows several `providerModel` candidates per logical model. On quota
exhaustion the adapter tries the next candidate before failing. Users don't care which
GPU farm rendered their clip; they care that it rendered.

### The reconciler

Hourly. `SELECT * FROM generations WHERE status NOT IN (terminal) AND queued_at <
now() - interval '20 minutes'`. Re-polls; if the provider has no record, marks
`failed/timeout` and refunds. This is the backstop that makes property 3 true rather
than aspirational — a dropped webhook plus a crashed worker still resolves within an
hour, with the user's credits back.

---

## Storage & delivery

1. Stream provider URL → Supabase Storage private bucket
   `generations/{workspace_id}/{generation_id}/output.mp4`. Streamed, never buffered
   in memory — a 1080p 8s clip is ~25MB and serverless memory is not free.
2. Probe dimensions/duration; extract a thumbnail (video: frame at 1s; image: resized
   WebP).
3. Write `generation_assets` rows with checksums.
4. Delivery is always a **short-lived signed URL** (1h view, 5min download), never a
   public bucket path. Share pages get their own signed URL minted server-side per
   request.

**Why copy at all instead of storing the provider's URL?** Provider URLs expire, often
within hours. History is worthless if last week's videos 404. Copying costs a few
seconds of worker time and makes the product's central retention promise true.

---

## The mock provider

Built **first**, in Tier 0, before any real integration.

```ts
class MockProvider implements ModelProvider {
  // Deterministic per prompt hash: same prompt → same asset, so demos are repeatable.
  // Walks queued→submitted→processing→downloading→ready on a realistic timeline
  //   scaled by the model's estimatedSeconds (or 3s in test mode).
  // Emits real determinate progress, so the honest-progress UI has something to show.
  // Deterministically fails ~1 in 12 with content_policy — which is how the refund
  //   path gets exercised on every demo run instead of never.
  // Returns from a curated asset pool in Storage.
}
```

What it buys:

- **A working live demo for a stranger, always.** No key, no quota, no spend ceiling
  can break the loop a reviewer walks through.
- **A sub-second test loop.** The full pipeline — ledger, state machine, realtime,
  refunds, storage — is integration-testable in milliseconds instead of minutes.
- **The failure path is demoable on demand.** A refund appearing in the ledger during
  the walkthrough is worth more than a fourth successful generation.

Selection: `PROVIDER_MODE = live | mock | auto`. In `auto` (production default), a
model resolves to the real provider while under the daily spend ceiling and falls back
to mock beyond it — with an honest badge in the UI saying so. Degrading visibly beats
erroring.

## Cost guardrails

| Control | Value |
|---|---|
| Global daily spend ceiling | env `DAILY_SPEND_CAP_CENTS`, checked before every live submit |
| Per-workspace daily cap | free plan: 3 live video generations/day |
| Live-enabled models | images: all (≈$0.01–0.04); video: fast tier only, 4–6s, 720p |
| Anonymous access | zero generation. Sign-in required. Public reads only. |
| Kill switch | `PROVIDER_MODE=mock` flips the whole deployment to zero spend in one env change |

`provider_cost_cents` is recorded per generation, so `/admin` shows credits sold
against dollars spent — the margin view the original clearly cares about
(`/admin/costs`, `/admin/revenue`) reduced to the one number that matters.

## Concurrency & the job tray

The client keeps N in-flight generations in a tray, each with its own Realtime
subscription (one channel, filtered by `workspace_id`, so it's one websocket not N).
Server-side concurrency is capped per workspace (free: 2, paid: 5) — over the cap,
jobs sit in `queued` with a position shown, rather than being rejected. A queue you can
see is better UX than a 429, and it's what makes the comparison feature (fire 4 models
at once) work on a free account.
