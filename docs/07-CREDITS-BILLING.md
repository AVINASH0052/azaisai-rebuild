# 07 — Credits & Billing

> **Adjusted by [18](18-FREE-TIER-STACK.md).** Stripe stays, in **test mode** (free
> forever), so the money path still demos end to end. `spend.daily_cents` becomes
> `quota.daily_requests` — same ledger, same engine, different unit, because on a free
> tier the scarce resource is API calls rather than dollars. Long videos are charged
> **per generated 8s segment**, not per delivered second ([19](19-LONG-VIDEO.md)).

## Credit semantics

A credit is an **integer**. Never fractional, never a float. All pricing arithmetic
rounds up at quote time and is then fixed:

```
video:  credits = ceil(model.rate_per_second × durationSeconds)
image:  credits = model.rate_per_image
```

Matches the original exactly. Sora Standard 8s → 8. Veo 3 8s → 24. Nano Banana → 1.
Quote is computed server-side and echoed to the client; the client's displayed estimate
is advisory and the server's number is authoritative. The client never sends a price.

## Plans

Copied from the original's `PRODUCTS` constant ([01](01-PRODUCT-TEARDOWN.md) §6),
because their pricing ladder is already tuned and there's no reason to invent one.

| Plan | Credits/mo | USD | Concurrency | Notes |
|---|---|---|---|---|
| Free | 5 one-time | $0 | 2 | email-verified, no phone wall, watermarked |
| Starter | 60 | $16.90 | 3 | |
| **Pro** | 180 | $32.90 | 5 | most popular |
| Business | 420 | $65.90 | 8 | commercial licence |

Top-up packs served from the DB via `GET /api/billing/plans`, so promos are data.
Currencies: schema and price table support all 11 the original lists; **USD only is
wired at runtime** ([02](02-SCOPE.md) Tier 2).

### Two buckets, different rules

| | Subscription credits | Purchased packs |
|---|---|---|
| Granted | on `invoice.paid`, each cycle | on `checkout.session.completed` |
| Expiry | end of billing period, **no rollover** | +12 months |
| Spend order | **first** | second |

Spend order is soonest-expiry-first. Burning the credits that are about to vanish
before the ones the user paid cash for is both correct and the choice a user would
make for themselves.

## Ledger operations

All in `services/credits/`. **The only code in the repo that writes `credit_ledger`.**

```ts
credits.grant({ workspaceId, amount, kind, expiresAt, sourceRef, idempotencyKey })
credits.debit({ workspaceId, amount, reason, generationId, idempotencyKey })
credits.refund({ generationId })              // idempotent on 'refund:'+generationId
credits.balance(workspaceId)                  // last balance_after, O(1)
credits.expire()                              // nightly sweep of lapsed grants
```

Every one:
- runs in a transaction that begins with `SELECT … FOR UPDATE` on the workspace row,
- writes `balance_after` computed inside that transaction,
- writes an `audit_events` row,
- takes an `idempotency_key` and relies on a unique index rather than an existence
  check (check-then-insert is a race; a unique constraint isn't).

`debit` additionally refuses to produce a negative balance — a check constraint on
`balance_after >= 0` is the last line of defence if application logic is ever wrong.

## Stripe integration

**Entitlement is granted by webhooks, never by the success redirect.** The redirect is
a UI convenience; a user who closes the tab still gets their credits, and a user who
replays the success URL doesn't get them twice.

| Event | Action |
|---|---|
| `checkout.session.completed` | mode=subscription → link customer + create subscription row. mode=payment → grant top-up pack. |
| `invoice.paid` | monthly cycle: expire the prior subscription grant, issue a new one, roll `current_period_*` |
| `invoice.payment_failed` | mark `past_due`, in-app banner, no credit change |
| `customer.subscription.updated` | plan change → prorate credit grant on upgrade; downgrade takes effect next cycle |
| `customer.subscription.deleted` | plan → `free` at period end; existing credits stay until expiry |
| `charge.dispute.created` | negative `chargeback` ledger row, freeze generation |

Every handler is idempotent on `stripe_event_id` (unique index on `credit_ledger`).
Stripe retries; a double grant is a real cash loss.

Cancellation, card updates, and invoices are handed to the **Stripe Billing Portal** —
one endpoint, zero UI to build, and it's better than anything we'd ship in an hour.

### Local & preview

Stripe test mode everywhere. `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
for local. Preview deploys use test keys and a separate webhook endpoint. The live
demo runs test mode with test cards documented on the pricing page, so a reviewer can
actually complete a purchase and watch credits land in the ledger — which is a far
better proof of the money path than a screenshot.

## The credits page

The original appears to show a balance. We show a **ledger**, because trust in a
metered product is entirely a function of being able to answer "where did my credits
go?"

```
Balance  43 credits          Pro · renews 6 Oct · 180/mo

  ┌ Expiring soon ────────────────────────────────────┐
  │ 38 subscription credits expire in 12 days          │
  │ 5 pack credits expire 12 Aug 2027                  │
  └────────────────────────────────────────────────────┘

  ─ 12   Veo 3 Fast · "A neon-lit city drone shot…"   [thumb]   6 Sep 14:02   → 43
  + 12   Refund · generation failed (content policy)            6 Sep 13:58   → 55
  ─ 12   Veo 3 Fast · "A neon-lit city drone shot…"             6 Sep 13:57   → 43
  +180   Subscription · Pro monthly                             1 Sep 09:00   → 55
  +  5   Welcome grant                                         28 Aug 11:20   → ...
```

Every row links to its generation. The refund row is the important one — it makes a
FAQ promise into something the user watched happen.

## Anti-abuse (replacing the phone wall)

The original gates 8 free credits on phone verification, one per number. That stops
abuse and it also stops activation ([01](01-PRODUCT-TEARDOWN.md) §7). Our replacement,
layered:

1. Turnstile on signup and on first generation of a session.
2. Email verification required before the grant lands (OTP already proves it).
3. Disposable-domain blocklist.
4. Velocity limits on signup per IP /24 and per ASN.
5. Device fingerprint (non-invasive: UA + accept headers + screen class) hashed and
   rate-limited — flagged, not blocked, to avoid false positives.
6. Smaller grant: **5 credits**, one image + a short video. Enough to see it work,
   not enough to be worth farming.
7. Free-tier live generation capped at 3/day per workspace and steered to cheap models.

Net: the marginal value of a farmed account drops below the marginal effort, without
asking a first-time visitor for their phone number. Stated as an explicit trade in
[12](12-DECISIONS-RISKS.md) — slightly higher abuse tolerance, materially better funnel,
and *necessary* given a public demo link.

## Unit economics tracking

`generations.provider_cost_cents` is written by the adapter on completion. That gives
us, per model, per day:

```
credits_sold_value − provider_cost = gross margin
```

Surfaced on `/admin` as one table. This is the compressed version of the original's
`/admin/revenue` + `/admin/costs` + `/admin/models` — the same question, one screen.
It's also the number that tells us which models to promote in the picker, which is a
product decision disguised as an ops dashboard.
