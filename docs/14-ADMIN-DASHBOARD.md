# 14 — Admin Dashboard & the Limits Engine

**This supersedes the `/admin` line in [02](02-SCOPE.md) Tier 3.** That doc cut ten of
the original's eleven admin routes and kept one read-only page. That was the right call
for *analytics* routes and it is the wrong call for *control* routes: without a way to
set a customer's limits, the only lever an operator has is a database console, and
every intervention is an unlogged manual UPDATE. That's not an admin gap, it's an
audit gap.

So the reframe: **the admin dashboard is not a reporting surface, it is the control
plane.** Reporting is a by-product.

---

## 1. The core idea: a policy engine, not a pile of toggles

The tempting build is a settings page that writes booleans onto the `workspaces` row —
`max_concurrent int`, `can_use_premium bool`, `is_suspended bool`. It works for three
weeks. Then limits need to differ by plan *and* by customer *and* during an incident,
the checks are scattered across six call sites that disagree, and nobody can answer
"why is this customer throttled?"

Instead: **one resolved policy object per workspace per request.** Every limit in the
product is a field on it. Every enforcement point reads it and nothing else.

```ts
type EffectivePolicy = {
  limits:   Record<LimitKey, number | boolean | string[]>;
  state:    "active" | "throttled" | "suspended" | "read_only";
  source:   Record<LimitKey, "platform" | "plan" | "override" | "clamp">;
  version:  number;       // for cache invalidation
  expiresAt: string | null;
};
```

The `source` map is what makes this operable. When support asks "why can't this
customer generate?", the admin UI shows the answer per-field: *concurrency = 1, source:
override, set by avinash 3 days ago, reason: "chargeback pending"*. That is the whole
value of doing it this way.

## 2. The limits catalogue

Every limit in the system, with plan defaults. These seed `plan_policies` and are
editable at runtime — changing a plan's limits must not require a deploy.

| Key | Free | Starter | Pro | Business | Platform max |
|---|---|---|---|---|---|
| `generations.per_minute` | 2 | 5 | 10 | 20 | 30 |
| `generations.per_day` | 5 | 60 | 200 | 600 | 1000 |
| `generations.concurrent` | 1 | 3 | 5 | 8 | 10 |
| `spend.daily_cents` (our COGS) | 50 | 500 | 2000 | 6000 | — |
| `video.max_duration_seconds` | 4 | 8 | 8 | 8 | 8 |
| `video.max_resolution` | 720p | 720p | 1080p | 1080p | — |
| `models.allowed_tiers` | `[fast]` | `[fast,standard]` | all | all | — |
| `models.denylist` | `[]` | `[]` | `[]` | `[]` | — |
| `storage.gb` | 1 | 10 | 50 | 200 | — |
| `prompt_assist.per_day` | 10 | 100 | 500 | 2000 | — |
| `api.enabled` | false | false | true | true | — |
| `api.per_minute` | — | — | 60 | 120 | 200 |
| `output.watermark` | true | false | false | false | — |
| `share.enabled` | true | true | true | true | — |
| `batch.max_models` | 2 | 3 | 4 | 4 | 4 |

Two distinct kinds of limit live in this table and it's worth naming the difference:
`generations.per_minute` protects *us* from a burst; `spend.daily_cents` protects us
from *cost*. The second one is the one that actually matters on a public demo link,
and it's denominated in our COGS (cents), not in credits — because credits are what we
sold and cents are what we pay. A customer on an annual deal with 10,000 credits can
still be capped at $20/day of GPU.

## 3. Resolution and clamping

```
resolve(workspace) =
    PLATFORM_DEFAULTS            // code constants, the floor
  ← plan_policies[ws.plan]       // DB, editable per plan
  ← workspace_policies[ws.id]    // DB, per-customer override, optionally expiring
  ⊓ platform_settings.clamps     // global ceilings — CLAMP, not merge
```

The last step is a **clamp, not an override**, and the distinction is load-bearing.
During a provider incident we set a global ceiling of `concurrent = 2`. If that merged
like the others, a customer with an override of `8` would keep their 8 and the incident
control would do nothing. Clamping takes the minimum, so the global ceiling always
wins downward — while never *raising* anyone's limit, which a naive `Math.min` on the
whole chain would get wrong in the other direction.

```ts
// services/policy/resolve.ts
export async function resolvePolicy(ws: Workspace): Promise<EffectivePolicy> {
  const base     = PLATFORM_DEFAULTS;
  const plan     = await planPolicy(ws.plan);
  const override = await workspaceOverride(ws.id);   // ignores expired rows
  const clamps   = await platformClamps();

  const merged = layer(base, plan, override);        // last non-null wins, tracks source
  return clampNumeric(merged, clamps);               // min() on numerics, AND on booleans,
                                                     // set-intersection on allowlists
}
```

**Failure mode: fail open.** If the resolver throws — bad JSON in an override, DB
blip, a migration mid-flight — it logs an error and returns `PLATFORM_DEFAULTS` rather
than denying. A bug in the limits system must never lock every customer out of the
product. The two things that still hold in that state are the credit balance check
(independent of policy) and the global spend cap read from env, so failing open costs
us bounded money and not correctness. An integration test asserts that a resolver
exception still permits a free-plan generation.

**Caching.** Resolution is 3 indexed reads. We cache the result for 60s keyed on
`(workspace_id, policy_version)`, where `policy_version` is a counter on the workspace
row bumped by any policy write. A stale cache is therefore detectable rather than
merely unlikely — and an admin lowering a limit takes effect on the next request, not
in 60 seconds, which is what you need during an incident.

## 4. Enforcement points

One policy, read at four places. Nowhere else in the codebase reads a limit.

| Point | Enforces | On breach |
|---|---|---|
| API middleware | `state` (suspended/read_only), `*.per_minute`, `api.*` | 403 `ACCOUNT_SUSPENDED` / 429 `RATE_LIMITED` + `Retry-After` |
| `generationService.submit` | `concurrent`, `per_day`, `models.*`, `video.max_*`, `batch.max_models`, `spend.daily_cents` | 429 `CONCURRENCY_LIMIT` / 403 `MODEL_NOT_AVAILABLE` / 402 `SPEND_CAP_REACHED` |
| `credits.debit` | balance (independent of policy) | 402 `INSUFFICIENT_CREDITS` |
| Storage upload | `storage.gb` | 413 `STORAGE_QUOTA_EXCEEDED` |

Each gets its own error code ([05](05-API-CONTRACT.md)) rather than a generic 429,
because the client renders a different recovery action for each — and because "we hit
our own cost ceiling" and "you are generating too fast" are different events that
should never be aggregated in a metric.

The spend check reads `sum(provider_cost_cents) for today` — actual COGS, not an
estimate. It's checked *before* submit using the model's p50 cost as the estimate, and
reconciled after completion with the real number.

## 5. Automated enforcement

The part that makes this scale past one operator. Admin sets thresholds; the system
acts. A human watching a dashboard is not a control.

| Rule | Trigger | Action | Reversal |
|---|---|---|---|
| Velocity throttle | >20 generations in 60s from a new (<24h) workspace | `state = throttled`, concurrency → 1 | auto after 1h clean |
| Spend circuit breaker | workspace exceeds `spend.daily_cents` | live models → mock for that workspace, badge shown | midnight UTC reset |
| Global circuit breaker | platform daily spend > `DAILY_SPEND_CAP_CENTS` | `PROVIDER_MODE` → mock platform-wide | manual |
| Chargeback freeze | `charge.dispute.created` | `state = read_only`, credits frozen | manual after review |
| Failure-rate model pull | model success rate <50% over 20 jobs | model `availability` → `mock_only`, alert | manual |
| Signup farm detector | >5 signups per IP /24 per hour | new workspaces start `throttled` | manual review queue |
| Abuse flag | 3 `content_policy` rejections in 10 minutes | flag for moderation, no auto-block | reviewer |

Every automated action writes an `admin_actions` row with `actor_type = 'system'` and
the rule name. So the audit log answers "who throttled this customer" identically
whether it was a person or a rule — which is the only way the log stays trustworthy.

**Deliberate choice: automated actions throttle and degrade, they never delete, never
refund, and never hard-suspend a paying customer.** The blast radius of a false
positive on an automated rule is capped at "annoying"; anything worse requires a human.

## 6. Data model additions

Extends [04](04-DATA-MODEL.md).

### `platform_admins` — **a separate authz plane**
| col | type | notes |
|---|---|---|
| `user_id` | uuid pk → auth.users | |
| `role` | admin_role | `support \| operator \| superadmin` |
| `granted_by` | uuid | |
| `granted_at`, `revoked_at` | timestamptz | |

**A workspace `owner` is not an admin.** This is the single most important line in the
doc. If admin were a role on `workspace_members`, then anyone who creates a workspace
is its owner, and one bad `WHERE` clause in a policy turns "owner of my own workspace"
into "operator of the platform." Platform admin is a distinct table, checked by a
distinct function, guarded by distinct RLS, and it is never derived from workspace
membership.

| Capability | support | operator | superadmin |
|---|---|---|---|
| View dashboards, workspaces, generation metadata | ✓ | ✓ | ✓ |
| Reveal a private prompt (audited) | ✓ | ✓ | ✓ |
| Grant/adjust credits (≤ 500) | ✓ | ✓ | ✓ |
| Set workspace limit overrides | — | ✓ | ✓ |
| Suspend / unsuspend a workspace | — | ✓ | ✓ |
| Force-fail + refund a stuck generation | — | ✓ | ✓ |
| Toggle model availability | — | ✓ | ✓ |
| Edit plan defaults / global clamps | — | — | ✓ |
| Grant admin access | — | — | ✓ |
| Flip `PROVIDER_MODE` platform-wide | — | — | ✓ |

### `plan_policies`
`plan` (pk, enum) · `limits jsonb` · `updated_by` · `updated_at`.
Seeded from §2. Editable by superadmin. Versioned — every write appends to
`plan_policies_history` so a bad edit is diffable and revertible.

### `workspace_policies`
`workspace_id` pk · `overrides jsonb` (sparse — only the keys actually overridden) ·
`state` · `reason text NOT NULL` · `set_by` · `set_at` · `expires_at timestamptz null`.

`reason` being NOT NULL is a small constraint that does a lot of work: it makes the
audit trail self-documenting, and it makes an operator pause before typing.
`expires_at` matters more than it looks — most overrides are temporary ("bumped for
their launch week"), and permanent overrides that should have been temporary are how a
limits system rots into meaninglessness. Expired rows stop applying automatically and
the UI shows a countdown.

### `platform_settings`
Single row. `clamps jsonb` · `provider_mode` · `daily_spend_cap_cents` ·
`signup_enabled bool` · `maintenance_message text null` · `updated_by` · `updated_at`.

The kill switches live in the database, not in env vars, so flipping one is instant and
audited rather than a redeploy. `DAILY_SPEND_CAP_CENTS` in env remains as the
last-resort floor if the DB is unreachable.

### `admin_actions`
`id` · `actor_user_id null` · `actor_type` (`admin | system`) · `action` ·
`subject_type` · `subject_id` · `before jsonb` · `after jsonb` · `reason` · `ip` ·
`created_at`. Append-only, same trigger guard as the ledger.

Storing `before`/`after` rather than just the new value means the log is a diff, which
is what you actually need at 2am.

### `moderation_flags`
`id` · `generation_id` · `source` (`auto | user_report | provider`) · `reason` ·
`status` (`open | reviewed | actioned | dismissed`) · `reviewed_by` · `notes`.

## 7. The screens

Seven routes. The original has eleven; these seven cover what those eleven were for,
minus the reposter program.

### `/admin` — Overview
The single-screen answer to "is the platform healthy and is it making money."
Spend today vs cap (the number that can hurt us most), queue depth and oldest waiting
job, success rate and p50 duration by model over 24h, credits sold vs COGS, signups and
activation today, and an incident strip showing any active global clamp or circuit
breaker with a one-click release.

### `/admin/workspaces` — the client list
The primary working surface. Table: workspace, plan, balance, 30-day generations,
30-day COGS, state, last active. Filter by state, plan, `over_limit`, `high_spend`,
`flagged`. Sort by COGS descending — which is the list of customers who might be
unprofitable, and it should be one click from the front door.

### `/admin/workspaces/[id]` — the client detail + **limits editor**
The screen the request is actually about.

```
Acme Studio            Pro · $32.90/mo · since 12 Aug        [Suspend] [Impersonate]

Balance  312 credits          30d: 847 generations · $41.20 COGS · $32.90 revenue
                                                              margin −$8.30  ⚠

┌ LIMITS ──────────────────────── showing: effective ▾ ───────────────────────┐
│                          effective    source          override              │
│ generations / min             10      plan            [    ] ⟲              │
│ generations / day            200      plan            [    ] ⟲              │
│ concurrent                     2      clamp ⚠         [  5 ]                │
│ daily spend                 $8.00     override        [ 800] set by avinash │
│                                       "unprofitable, capped pending review" │
│                                       expires in 4 days                     │
│ max resolution              1080p     plan            [    ] ⟲              │
│ allowed model tiers        all        plan            [    ] ⟲              │
│                                                                             │
│ ⚠ concurrent is clamped platform-wide to 2 (provider incident, 2h ago)      │
│                                                                             │
│ Reason for change (required) [_________________________]  Expires [7 days ▾]│
│                                              [ Preview diff ] [ Apply ]     │
└─────────────────────────────────────────────────────────────────────────────┘

Recent generations · Ledger · Admin action history
```

Three details that make it usable rather than dangerous: the **source** column so you
know whether you're fighting a plan default or an existing override; the **clamp
warning** so you don't set a limit that silently won't apply; and **Preview diff**,
which shows the resolved before/after policy — because the whole point of a layered
system is that the effect of an edit isn't obvious from the edit.

### `/admin/generations` — the job inspector
Live view of non-terminal jobs with age, model, workspace, attempt count. Actions:
retry, force-fail-and-refund, cancel. Filter to `stuck` (past SLA). This is what turns
a 2am "my video never finished" into a 30-second fix, and it's the manual counterpart
to the reconciler ([06](06-GENERATION-PIPELINE.md)).

### `/admin/models` — availability control
Per model: 24h volume, success rate, p50 duration, avg COGS, credits charged, margin.
Toggle `live | mock_only | disabled` per model. The margin column is a product input,
not just an ops one — it tells you which models to promote in the picker and which
credit rates are mispriced.

### `/admin/economics`
Revenue (from Stripe) vs COGS (from `provider_cost_cents`) by day, plan, and model.
MRR, ARPU, credits outstanding as a liability. Replaces the original's `/admin/revenue`
+ `/admin/costs` + parts of `/admin/insights`.

### `/admin/moderation` + `/admin/audit`
The flag queue, and a filterable view of `admin_actions` + `audit_events`.

## 8. The other half: what the client sees at a limit

A limits system is half enforcement and half explanation. Getting blocked with no idea
why is the worst experience in a metered product, and it generates the support load
that the admin dashboard then has to absorb.

- The credit chip in the topbar expands to show *all* active limits and their reset
  times, not just credits.
- Hitting a limit produces a specific message naming the limit, the reset time, and the
  fix: *"You're at 5 concurrent generations (Pro limit). One will start when another
  finishes — or upgrade for 8."*
- Over-limit requests **queue where queuing is sensible** (concurrency) rather than
  erroring, and only 429 where it isn't (per-minute burst).
- Suspension shows a real reason and a contact route, never a blank 403.
- If a workspace is degraded to mock by the spend breaker, the UI says so plainly with
  a badge. Silently serving sample output as if it were real is the one thing here that
  would be genuinely dishonest.

**And the product insight:** `/admin/workspaces?filter=over_limit` is a list of
customers who want to spend more money than their plan allows. That's a sales lead
list, not an ops queue. It's the most valuable screen in the dashboard and it falls out
of the limits engine for free.

## 9. Safety rails on admin itself

Admin is the highest-privilege surface in the product and gets treated that way.

- **Separate authz plane** (§6) — never derived from workspace roles.
- **Read-only by default.** `support` can see everything and change almost nothing.
- **Reason required** on every mutating action, stored on the audit row.
- **Typed confirmation** for suspend, plan change, and any credit grant > 500 — type
  the workspace name, not just click OK.
- **Impersonation is read-only**, time-boxed to 30 minutes, shows a permanent banner to
  the admin, cannot spend credits or generate, and writes an audit row on entry and
  exit. Read-only impersonation covers ~95% of support cases and removes the entire
  class of "an admin accidentally did something as a customer."
- **Privacy-preserving by default.** Prompts and outputs of private generations are
  **masked** in admin views. Revealing one is a distinct, audited action with a reason.
  The original's About page promises "your generations are private — we don't share or
  use your content"; an admin panel that shows every prompt by default quietly breaks
  that promise. Masked-by-default costs one click and keeps it true.
- **No hard deletes from admin.** Ever. Soft delete only.
- Admin routes are rate-limited, IP-logged, and require a re-auth (fresh OTP) if the
  session is older than 12 hours.
- Admin bundle is a separate route group, `dynamic = 'force-dynamic'`, never
  prerendered, `noindex`.

## 10. Delivery

This adds real scope. Honest sizing against the [11](11-DELIVERY-PLAN.md) schedule:

**Tier A — ships in the 12h window (~75 min, inserted at H9.5–H10.75):**
- `platform_admins`, `plan_policies`, `workspace_policies`, `platform_settings`,
  `admin_actions` tables + RLS
- `resolvePolicy()` with layering + clamping + cache, and the four enforcement points
- Client-side limit messaging (§8)
- `/admin` overview, `/admin/workspaces` list, `/admin/workspaces/[id]` with the
  **limits editor and preview diff**
- Audit row on every admin write
- Two automated rules: spend circuit breaker and global circuit breaker

That's the request answered: limits are configurable per client, enforced everywhere,
and audited.

**Tier B — if the schedule holds (~40 min):**
`/admin/generations` inspector with force-fail-and-refund; `/admin/models` availability
toggles; remaining automated rules.

**Tier C — foundations only, no UI:**
`/admin/economics` (the queries exist for the overview page), `/admin/moderation`
(`moderation_flags` table exists, auto-flagging writes to it), `/admin/audit` viewer
(`admin_actions` is written from day one, readable via SQL), impersonation.

**What this displaces.** Something has to give. The cut order in
[11](11-DELIVERY-PLAN.md) already names prompt enhance/variate and the Stripe
integration as items 2 and 3. Tier A takes the slot; if we're behind at H9.5, prompt
enhance/variate goes first — a limits control plane demonstrates more engineering
judgement in a walkthrough than an LLM rewrite button does.

## 11. Open decisions

1. **Should plan limits be editable at runtime, or code constants?** Plan: editable in
   DB with history, because a limit change shouldn't need a deploy. Risk: a bad edit
   affects every customer on that plan at once. Mitigated by preview-diff + history +
   superadmin-only. Reconsider if it feels too sharp.
2. **Queue vs reject at the concurrency limit.** Plan: queue with visible position,
   because it makes compare-mode work on a free account ([06](06-GENERATION-PIPELINE.md)).
   Needs a max queue depth so it can't grow without bound.
3. **Should `support` be able to grant credits at all?** Plan: yes, capped at 500,
   audited. It's the single most common support resolution and routing it through an
   operator makes support slow for no safety gain.
4. **Per-model spend caps** in addition to per-workspace. Probably yes eventually; not
   in this window.
