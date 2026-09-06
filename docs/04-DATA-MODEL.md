# 04 — Data Model

Postgres 15 (Supabase). Drizzle schema in `src/db/schema/`, migrations in `drizzle/`,
RLS policies as committed SQL in `supabase/policies/`.

## Conventions

- Primary keys: `uuid` v7 (`gen_random_uuid()` in DB; app generates v7 for sortability
  where insertion order matters).
- Timestamps: `timestamptz`, always UTC, `created_at`/`updated_at` on everything.
- Money: **integer minor units only**. `price_in_cents int`, `currency char(3)`.
  No floats anywhere near money. Credits are integers too — never fractional.
- Soft delete: `deleted_at timestamptz` on user content. Hard delete only via the
  GDPR erasure path.
- Enums: real Postgres enums, so a bad value is a constraint violation, not a bug.
- **Every tenant-scoped table carries `workspace_id`.** No exceptions.

## Entity map

```
auth.users (Supabase)
   │
   └─1:N─ workspace_members ─N:1─ workspaces
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
   credit_ledger              generations ─1:N─ generation_assets  subscriptions
   (append-only)                    │                              credit_grants
                              share_links                          audit_events
                                                                   api_keys
```

---

## Tables

### `workspaces`
| col | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `name` | text | "Personal" by default |
| `slug` | citext unique | for future team URLs |
| `plan` | plan_enum | `free \| starter \| pro \| business` |
| `owner_user_id` | uuid → auth.users | |
| `created_at`,`updated_at` | timestamptz | |

### `workspace_members`
| col | type | notes |
|---|---|---|
| `workspace_id` | uuid fk | |
| `user_id` | uuid fk | |
| `role` | role_enum | `owner \| admin \| member \| viewer` |
| pk | (`workspace_id`,`user_id`) | |

### `profiles`
Mirrors `auth.users` for joinable app data. `user_id` pk, `display_name`, `avatar_url`,
`default_workspace_id`, `referred_by uuid`, `marketing_opt_in bool`,
`onboarded_at timestamptz`.

---

### `credit_ledger` — **append-only. the money table.**

This is the most important table in the system. It is a journal, not a balance.

| col | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid fk, indexed | |
| `amount` | integer | **signed.** negative = debit, positive = credit |
| `reason` | ledger_reason enum | see below |
| `balance_after` | integer | denormalised, computed inside the txn. makes the ledger auditable by eye and lets the UI render a running balance without a window function. |
| `generation_id` | uuid fk null | set for `generation_debit` / `generation_refund` |
| `grant_id` | uuid fk null | which bucket this debit drew from |
| `stripe_event_id` | text null | |
| `idempotency_key` | text null | **unique** partial index where not null |
| `metadata` | jsonb | model, params, stripe object ids, admin actor |
| `created_at` | timestamptz | |

`ledger_reason`: `signup_grant | referral_grant | promo_grant | subscription_grant |
topup_purchase | generation_debit | generation_refund | expiry | admin_adjustment |
chargeback`.

**Invariants, enforced not assumed:**
1. **No UPDATE, no DELETE.** A `BEFORE UPDATE OR DELETE` trigger raises an exception.
   Corrections are new compensating rows. This is what makes it an audit trail.
2. `balance_after` of row N must equal `balance_after` of row N-1 + `amount`.
   Verified by a nightly check job and asserted in tests.
3. Balance is *never* stored on `workspaces`. It is read as
   `select balance_after from credit_ledger where workspace_id=$1 order by created_at desc limit 1`
   — O(1) with the right index, and impossible to drift.
4. Every debit takes `SELECT … FOR UPDATE` on the workspace row first, so concurrent
   generations can't oversell the balance. This is the classic double-spend and it is
   handled with a row lock, not optimistic hope.
5. `amount = 0` is disallowed by a check constraint.

**Why not a `credits int` column on `workspaces`?** Because the FAQ promises "credits
are never charged for failed generations," monthly resets that don't roll over, and
12-month pack expiry. All three are *temporal* questions about money. A single mutable
integer can answer none of them, and the first support ticket asking "where did my
credits go" is unanswerable. The ledger costs about forty extra lines and answers
every one of them forever.

### `credit_grants` — buckets, for expiry and spend ordering
| col | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid fk | |
| `kind` | grant_kind | `signup \| subscription \| topup \| promo \| referral` |
| `amount` | integer | granted |
| `consumed` | integer | running total spent from this bucket |
| `expires_at` | timestamptz null | subscription → next cycle; topup → +12 months; signup → null |
| `source_ref` | text | stripe invoice/payment id |

**Spend order:** soonest-expiring first, then oldest. So subscription credits burn
before purchased packs, which is both correct for the user (packs last 12 months) and
correct for us. Implemented in `credits.debit()` as a single ordered scan; the chosen
`grant_id` is recorded on the ledger row.

---

### `generations` — the core entity

| col | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid fk, indexed | |
| `created_by_user_id` | uuid fk | |
| `share_id` | text unique | short nanoid, only set when shared |
| `kind` | gen_kind | `video \| image` |
| `status` | gen_status | see state machine below |
| `stage` | text null | human label for the current phase |
| `model_id` | text | registry key, e.g. `veo-3-fast` |
| `provider` | text | `fal \| mock` |
| `provider_job_id` | text null | |
| `prompt` | text | |
| `enhanced_prompt` | text null | if Enhance was used, both are kept |
| `negative_prompt` | text null | |
| `params` | jsonb | validated against the model's capability schema |
| `source_image_path` | text null | image→video |
| `credits_quoted` | integer | what we told the user |
| `credits_charged` | integer | what we actually took |
| `credits_refunded` | integer default 0 | |
| `provider_cost_cents` | integer null | our COGS. drives `/admin` margin view. |
| `idempotency_key` | text | unique per workspace |
| `batch_id` | uuid null | groups a multi-model comparison run |
| `error_code` | text null | closed union from the adapter |
| `error_message` | text null | user-safe copy |
| `attempt` | smallint default 0 | retry counter |
| `queued_at`,`started_at`,`completed_at` | timestamptz null | for real duration stats |
| `visibility` | vis_enum | `private \| unlisted \| public` |
| `deleted_at` | timestamptz null | |

`gen_status`: `queued | submitted | processing | downloading | ready | failed | cancelled`

Indexes: `(workspace_id, created_at desc)` for history; `(status)` partial where
status in non-terminal states, for the worker's claim query; `(share_id)` unique;
`(batch_id)`.

### `generation_assets`
One generation can yield several files (output, thumbnail, clean vs watermarked).

| col | type |
|---|---|
| `id` uuid pk, `generation_id` uuid fk |
| `role` asset_role — `output \| thumbnail \| preview \| source \| watermarked` |
| `storage_path` text, `mime` text, `bytes` bigint |
| `width` int, `height` int, `duration_ms` int null |
| `checksum` text |

Splitting assets out is what makes the watermark story (Tier 2) a delivery decision
rather than a schema migration: store `output` clean, store `watermarked`, and pick
which one to sign based on plan.

### `share_links`
`id`, `generation_id`, `share_id` (nanoid), `created_by`, `views int`,
`expires_at null`, `revoked_at null`.

### `subscriptions`
`workspace_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`
(`trialing|active|past_due|canceled|incomplete`), `current_period_start/end`,
`cancel_at_period_end bool`.

### `audit_events`
`id`, `workspace_id`, `actor_user_id null`, `actor_type` (`user|system|admin|api_key`),
`action` text, `subject_type` text, `subject_id` uuid, `metadata` jsonb, `ip inet`,
`user_agent` text, `created_at`.

Written for: every ledger mutation, every generation create/delete, every plan change,
every admin action, every share toggle. Append-only, same trigger guard as the ledger.

### `api_keys`
`id`, `workspace_id`, `name`, `key_prefix` (shown in UI), `key_hash` (argon2id),
`scopes text[]`, `last_used_at`, `expires_at`, `revoked_at`. Plaintext shown exactly
once at creation.

### `job_outbox`
`id`, `generation_id`, `run_after timestamptz`, `attempts smallint`,
`locked_until timestamptz null`, `locked_by text null`.

Inserted in the **same transaction** as the generation row — the transactional outbox
pattern. This is what guarantees a generation can never exist without a job, and a job
can never exist for a generation that got rolled back.

### Admin & policy tables
`platform_admins`, `plan_policies` (+ `_history`), `workspace_policies`,
`platform_settings`, `admin_actions`, `moderation_flags` — defined in
[14](14-ADMIN-DASHBOARD.md) §6. Two notes that belong here: `platform_admins` is a
**separate authz plane**, never derived from `workspace_members`, and `admin_actions`
carries the same append-only trigger guard as `credit_ledger`.

### `analytics_events`
`id`, `workspace_id null`, `user_id null`, `anonymous_id`, `name`, `props jsonb`,
`session_id`, `created_at`. One table replacing three vendors ([02](02-SCOPE.md)).

---

## Generation state machine

```
                  ┌──────────── retry (attempt < 3, backoff) ───────────┐
                  ▼                                                     │
  queued ──► submitted ──► processing ──► downloading ──► ready         │
     │           │              │              │                        │
     │           └──────────────┴──────────────┴───► failed ────────────┘
     │                                                 │
     └──────────► cancelled ◄──────────────────────────┘ (terminal after 3)
```

- `queued` — row written, credits debited, outbox job pending. **Credits already
  taken.** We debit on submit, not on success, because that's the only way to prevent
  a burst of concurrent jobs from overspending a balance.
- `submitted` — provider accepted, `provider_job_id` set.
- `processing` — provider is working. `stage` carries the vendor's label when it gives
  one, otherwise ours.
- `downloading` — we're copying the artifact from the provider into our own storage.
  Deliberately a visible state: it's real work (a 20MB MP4), it takes seconds, and
  showing it is more honest than a fake 95% bar.
- `ready` / `failed` / `cancelled` — terminal. `completed_at` set.

**Refund rule:** entering `failed` terminally with `billable = false` triggers
`credits.refund(generation_id)` in the same transaction as the status write. Idempotent
on `generation_id + reason`, so a duplicate webhook can't double-refund.

---

## RLS

Enabled on every application table. Policy shape, uniform:

```sql
-- read
using (workspace_id in (select workspace_id from workspace_members
                        where user_id = auth.uid()))
-- write: same, plus role check
with check (workspace_id in (select workspace_id from workspace_members
                             where user_id = auth.uid()
                               and role in ('owner','admin','member')))
```

Specific carve-outs:
- `credit_ledger`, `audit_events`: **select only** for members. All inserts go through
  the service role inside a service transaction. Users can read their money history
  and cannot write it.
- `generations`: an extra permissive select policy for
  `visibility = 'public' and deleted_at is null`, which is what makes the share
  permalink and the landing-page gallery work for anonymous visitors with no
  service-role key in the browser.
- `api_keys`: `key_hash` never selectable — enforced by a view that omits it.

The membership subquery is wrapped in a `security definer` function
`current_workspace_ids()` marked `stable`, so Postgres caches it per statement instead
of re-running it per row. Without that, RLS on a history query is a nested loop over
every row and the page is slow at 10k generations. This is the sort of thing that is
free to do now and a production incident later.

---

## Migrations

`drizzle-kit generate` → SQL file → committed → applied by `pnpm db:migrate` in CI
before deploy. Rules: forward-only, additive first (add column → backfill → switch
reads → drop later), never destructive in the same migration as a code change.
Every migration runs against a scratch branch DB in CI before it touches production.

## Seed

`scripts/seed.ts` creates a demo workspace, ~15 public generations across models with
real thumbnails, a credit ledger with a grant, several debits, and **one visible
refund**, plus one Stripe test subscription. This is what makes the landing gallery,
the credits ledger, and `/admin` non-empty on first load for a stranger.
