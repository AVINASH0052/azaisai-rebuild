# 09 — Security, Privacy & Compliance

## Threat model

The assets worth attacking, in order:

1. **Credits** — they convert directly to GPU time we pay for. This is the money.
2. **Generated content** — private user media; a leak is a privacy incident.
3. **Provider API keys** — direct access to our billing at another vendor.
4. **Stripe entitlement** — a forged webhook is free credits forever.
5. **Account takeover** — email OTP is the only factor.

### Attacks and controls

| Attack | Control |
|---|---|
| Client calls a credit-mutation endpoint directly | There is no such endpoint. Credits move only as a server-side side effect. (Explicit divergence from the original's `POST /api/credits/deduct`.) |
| Concurrent submits to overspend a balance | `SELECT … FOR UPDATE` on the workspace row inside the debit transaction + a `balance_after >= 0` check constraint |
| Replaying a generation request | `Idempotency-Key` with a unique index; replay returns the original response |
| Forged Stripe webhook | Signature verification on the raw body; unknown events ignored, not defaulted |
| Duplicate Stripe delivery → double grant | Unique index on `stripe_event_id` |
| Signup farming for free credits | Turnstile + email verification + disposable-domain blocklist + IP/ASN velocity + 5-credit grant + 3/day live cap ([07](07-CREDITS-BILLING.md)) |
| Reading another workspace's generations | RLS on every table, keyed on workspace membership; cross-workspace reads return 404 not 403 so ids aren't enumerable |
| Guessing a share URL | 12-char nanoid (~71 bits); revocable; `noindex` unless the user opts into the public gallery |
| Hotlinking / scraping outputs | Private buckets, short-lived signed URLs only (1h view, 5min download). No public object paths. |
| Prompt injection via user prompt into our Enhance LLM | The LLM's output is treated as *text to put in a textarea*, never as instructions and never as a tool-call target. It cannot reach any tool. |
| SSRF via `sourceImageUrl` | We never fetch arbitrary user URLs. Source images are uploaded to our storage through a signed URL and referenced by internal path. |
| Malicious upload | Server-side MIME sniff (magic bytes, not the header), size cap, dimension cap, re-encode before use |
| XSS via prompt text rendered on a share page | React escaping + a strict CSP; no `dangerouslySetInnerHTML` anywhere in the codebase (lint-enforced) |
| Worker endpoint invoked by a stranger | `CRON_SECRET` + Vercel's cron signature; both required |
| Stolen session cookie | httpOnly, secure, sameSite=lax, short-lived access token + rotating refresh (Supabase defaults, not loosened) |
| Admin mailbox compromise → platform takeover | Admin surfaces require `aal2` (email OTP **+** TOTP); email OTP alone reaches only the user's own product surfaces ([16](16-AUTH-AND-ROUTING.md)) |
| Enumerating admin accounts via the login form | Sign-in behaves identically for every email — same copy, timing, errors, rate limits. The `platform_admins` lookup happens in `/auth/callback`, after code verification, never in `send-otp` |
| Open redirect on the auth callback | `returnUrl` validated server-side: relative same-origin paths only, no protocol-relative `//host`, no encoded traversal |
| Privilege escalation via signup | No code path from signup to `platform_admins` — not a flag, invite code, or email domain. Only the one-shot seed script and an audited superadmin action can write it |

## Authorization matrix

`lib/auth/authorize.ts` — one function, called at the top of every handler. Not
scattered `if` statements.

| Action | viewer | member | admin | owner |
|---|---|---|---|---|
| Read generations | ✓ | ✓ | ✓ | ✓ |
| Create generation (spend) | — | ✓ | ✓ | ✓ |
| Delete own generation | — | ✓ | ✓ | ✓ |
| Delete any generation | — | — | ✓ | ✓ |
| Share / revoke share | — | ✓ | ✓ | ✓ |
| Read credit ledger | — | ✓ | ✓ | ✓ |
| Purchase / manage billing | — | — | — | ✓ |
| Manage members | — | — | ✓ | ✓ |
| Manage API keys | — | — | ✓ | ✓ |

Roles exist and are enforced from day one even though there's no UI to change them
([02](02-SCOPE.md) Tier 2). Retrofitting authorization is how security bugs happen.

**Platform admin is a separate plane.** `platform_admins` is its own table with its own
roles (`support | operator | superadmin`), checked by its own function, and it is never
derived from workspace membership — otherwise every user, being the owner of their own
personal workspace, is one bad `WHERE` clause away from being a platform operator.
Full capability matrix and the rails on admin itself (read-only default, required
reasons, typed confirmations, read-only time-boxed impersonation, prompts masked by
default, no hard deletes) in [14](14-ADMIN-DASHBOARD.md) §6 and §9.

**Defence in depth:** RLS in the database *and* the authorize check in the service.
Either alone would do; both means a mistake in one is not an incident.

## Secrets

- Nothing sensitive in `NEXT_PUBLIC_*`. Only the Supabase URL and anon key, which are
  designed to be public and are useless without RLS being wrong.
- `SUPABASE_SERVICE_ROLE_KEY`, `FAL_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `ANTHROPIC_API_KEY`, `CRON_SECRET` — server-only, Vercel env vars, never in the repo.
- `env.ts` validates every variable with Zod **at boot**. A missing key fails the
  build, not a request at 2am.
- `.env.example` committed with placeholder values and comments; `.env.local`
  gitignored.
- **`.agent-logs/` is public and verbatim, so no secret is ever pasted into a prompt.**
  Keys are set via `vercel env add` and the Supabase dashboard, never typed into chat.
  This is a working rule, not a redaction filter — a filter would mean editing log
  entries, which the capture brief forbids ([00](00-AGENT-CAPTURE.md)).
- Rotation: any key that touches a log or a screenshot is rotated before submission.

## Headers & CSP

Set in `next.config.ts` + middleware:

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-<per-request>' https://challenges.cloudflare.com https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.supabase.co;
  media-src 'self' blob: https://*.supabase.co;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com;
  frame-src https://challenges.cloudflare.com https://js.stripe.com;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self';
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)
```

Nonce-based script-src, so no `unsafe-inline` on scripts. Verified with
securityheaders.com before submission.

## Content safety

- Pre-submit prompt screen against a blocklist for the categories every provider
  rejects anyway (CSAM, real-person sexual content, credible violence). Cheap, fast,
  and it means we're not paying to have a provider reject it.
- Provider `content_policy` rejections surface as a specific, non-judgemental error
  with a rewrite affordance — and a full credit refund.
- Named-public-figure prompts are allowed through (providers have their own policies)
  but flagged in `audit_events` for review.
- Every generation is attributable: `created_by_user_id`, IP, and UA in the audit log.
- `/report/[shareId]` on public share pages, and a share link is revocable in one click.

## Privacy

- Data collected: email, generated content, prompts, usage events, Stripe customer id.
  No phone number — we removed that requirement ([07](07-CREDITS-BILLING.md)).
- Retention: generations kept until deleted; soft-deleted assets purged after 30 days;
  audit and ledger rows retained 7 years (financial records); analytics events 13 months.
- **Export**: `GET /api/account/export` → JSON of profile, generations, ledger + signed
  URLs for every asset.
- **Erasure**: `POST /api/account/delete` → 7-day grace, then hard delete of profile,
  generations, and storage. Ledger rows are *anonymised* (user id nulled) rather than
  deleted, because they're financial records — which is the correct GDPR reading and
  the one that survives an audit.
- We do not train on user content and do not share it. The original says the same; ours
  is stated in the Privacy Policy with the provider sub-processors named (fal.ai,
  Supabase, Stripe, Vercel, Anthropic), which the original's does not do.
- Cookies: session (essential) only. No third-party marketing pixels
  ([02](02-SCOPE.md) cuts GA4/TikTok), so no consent banner is needed — a real UX win
  that falls out of a scope decision.

## Dependency & supply chain

- `pnpm` with a committed lockfile; `pnpm audit` in CI, build fails on high/critical.
- Dependabot weekly.
- No `postinstall` scripts from transitive deps (`pnpm` `--ignore-scripts` with an
  explicit allowlist).
- CI runs on a pinned Node version; no `latest` tags anywhere.

## Pre-submission security pass

Run `/security-review` over the full diff, plus this checklist:

- [ ] No service-role key reachable from any client bundle (`grep` the build output)
- [ ] RLS enabled and policied on **every** table — verified by a query against
      `pg_policies`, not by memory
- [ ] Anonymous Supabase client can read only `visibility='public'` generations —
      tested with a real anon-key request
- [ ] Stripe webhook rejects an unsigned payload
- [ ] Worker endpoint 401s without `CRON_SECRET`
- [ ] Signed URLs expire; an expired one 403s
- [ ] `.agent-logs/` scanned for anything key-shaped before the final push
- [ ] securityheaders.com grade A
- [ ] Test-mode Stripe keys only in the public deployment
