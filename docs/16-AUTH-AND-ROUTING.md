# 16 — Unified Sign-in & Role-Based Routing

**Answer: yes.** Everything on one Vercel deployment. One landing page, one sign-in
form, one session. If the account is a platform admin, sign-in lands on `/admin`;
otherwise it lands on the studio. No second app, no second login page, no separate
admin domain.

This is also the *safer* option, which is worth explaining because the instinct usually
runs the other way.

## Why not a separate `/admin/login`

A dedicated admin login feels more secure and generally isn't:

- It's a **second auth surface** — a second set of rate limits, a second session
  handler, a second place to get CSRF or redirect validation wrong. Two implementations
  means the weaker one defines your security.
- It **advertises the admin panel**. A route that exists and returns a login form
  confirms there's something behind it.
- It gets built later and maintained less. The main login gets Turnstile, lockouts, and
  attention; the admin login gets whatever was quick.
- It tempts a **separate credential system** — an admin password table — which is
  strictly worse than the passwordless flow the rest of the product uses.

The control is authorization, not a separate door. Stripe, Vercel, and Linear all route
by role after a single sign-in. We do the same.

## The flow

```
   /                    landing page (public, Vercel)
   │  Sign in / Sign up
   ▼
   /auth/login          ONE form. email → 6-digit code. Turnstile.
   │                    Identical copy, timing, and errors for every account.
   ▼
   /auth/callback       session established (aal1)
   │
   ├─ is the user in platform_admins (not revoked)?
   │     │
   │     ├─ no  ──────────────────────────────► /studio/video
   │     │
   │     └─ yes ──► has this session completed TOTP? (aal2)
   │                   │
   │                   ├─ yes ────────────────► /admin
   │                   └─ no  ──► /auth/mfa ──► /admin
   │
   └─ returnUrl present and safe? → that wins over both defaults
```

### Routing precedence

| Priority | Destination | Condition |
|---|---|---|
| 1 | `returnUrl` | present, same-origin, and passes the allowlist check |
| 2 | `/admin` | user is in `platform_admins` |
| 3 | `/studio/video` | everyone else — matches the original's `DEFAULT_AUTH_REDIRECT` |

`returnUrl` is validated server-side against a same-origin allowlist. An open redirect
on a login callback is the classic way this exact pattern gets exploited — an attacker
sends `?returnUrl=https://evil.tld` and harvests whatever the app appends. Relative
paths only, no protocol-relative `//host`, no encoded traversal.

### The decision is server-side, always

The `platform_admins` lookup happens in the route handler for `/auth/callback`, not in
a client component reading a flag. A client-side role check is a rendering hint, never
a control — anyone can flip a boolean in devtools. The client is told where to go; it
never decides.

## No admin oracle

The sign-in form must behave **identically** for an admin email and an unknown one:
same copy, same success message, same error text, same response timing, same rate
limits. If entering an admin's address produces any observable difference — a different
message, an extra field, a slower response — the login form has become an admin-email
enumeration oracle.

The role is discovered *after* the code is verified, never before. Concretely: the
`platform_admins` lookup happens in `/auth/callback`, not in `/auth/send-otp`.

## Step-up authentication for admin

Email OTP alone is not sufficient for a platform operator. Anyone with mailbox access
would become one, and mailbox compromise is the single most common account-takeover
path.

**Admins require TOTP.** Supabase Auth supports MFA natively with assurance levels:

| Level | Reached by | Unlocks |
|---|---|---|
| `aal1` | email OTP | the product — studio, history, credits, billing |
| `aal2` | email OTP + TOTP | `/admin/*` and every admin API route |

So an admin signs in exactly like everyone else, then completes a 6-digit
authenticator code once per session before the admin surface unlocks. Their *user*
surfaces work at `aal1` — MFA gates admin, not the whole account.

Enrollment is forced: a user granted an admin role is required to enroll TOTP on their
next sign-in before `/admin` becomes reachable. Sessions drop back to requiring `aal2`
re-verification after 12 hours ([14](14-ADMIN-DASHBOARD.md) §9).

**On "admin credentials" specifically:** admins don't get passwords. Adding a password
path just for admin means storing passwords, handling resets, and running a second
credential system alongside the passwordless one. Email OTP + TOTP is strictly stronger
than a password alone, and it reuses code we've already written.

## Three enforcement layers

Middleware is a redirect, not authorization. Defence in depth:

| Layer | Checks | On failure |
|---|---|---|
| Edge middleware | session exists; `is_admin` claim on the JWT | redirect to `/auth/login?returnUrl=…` |
| `/admin` layout (server component) | fresh `platform_admins` read + `aal2` | `notFound()` or `/auth/mfa` |
| Every admin service call | role capability from the matrix in [14](14-ADMIN-DASHBOARD.md) §6 | 403 + audit row |

The middleware check reads a cached JWT claim, which can be up to a token-refresh stale
— fine for a redirect, not acceptable as the only gate on revocation. The layout does a
live table read so a revoked admin loses access immediately.

**A non-admin hitting `/admin` gets a 404, not a 403.** A 403 confirms the route
exists. The authz doesn't depend on that, but there's no reason to volunteer it.
`/admin` is also `noindex`, never linked in public nav, and `force-dynamic` so it is
never prerendered into a static asset.

## Admins are users too

An admin has a personal workspace and can generate like anyone else — otherwise nobody
dogfoods the product. So `/admin` is where they *land*, not where they're trapped: the
app shell carries a switcher.

```
┌──────────────────────────────────────────────────────┐
│ ▣ AzaisAI    [ Studio ⇄ Admin ]        avinash ▾     │
└──────────────────────────────────────────────────────┘
```

The switcher renders only for `aal2` admins. Everyone else has never seen it and can't
make it appear.

## Bootstrapping the first admin

Otherwise there's a chicken-and-egg problem: only a superadmin can grant admin, and
there is no superadmin.

`scripts/seed-admin.ts`, run once against each environment, reads `SEED_ADMIN_EMAIL`
from the environment and inserts a `superadmin` row for that user (creating the auth
user if needed). It refuses to run if any `platform_admins` row already exists, so it
can't be replayed to escalate. After the first admin exists, every further grant goes
through the audited admin UI.

**Signup can never create an admin.** There is no code path from `/auth/signup` to
`platform_admins` — not a flag, not an invite code, not a special email domain. The
only two writers are the seed script and a superadmin action, both audited.

## Demo access for the reviewer

The walkthrough needs to show the admin dashboard, and the brief's live link is opened
by someone who isn't me. So the seed creates **two** demo accounts:

| Account | Role | Purpose |
|---|---|---|
| demo user | normal | generate, share, view the ledger |
| demo admin | `support` (read-only) | see the dashboard and limits editor, change nothing |

The demo admin is deliberately `support`, the read-only tier — it can view workspaces,
dashboards, and the resolved-policy view, but cannot set overrides, suspend anyone, or
adjust credits. If those credentials end up somewhere public, the blast radius is
reading a seeded demo dataset. Credentials go in the README, and the demo admin's TOTP
requirement is waived by a `demo_readonly` flag on the row — the one MFA exception in
the system, scoped to an account that can't write.

Real operator accounts are `operator`/`superadmin`, MFA-enforced, and never documented
anywhere public.

## Delivery impact

Small — most of this is already in the H1.5–H2.5 auth slot.

Added to **H1.5–H2.5** (~15 min):
- [ ] `/auth/callback` role lookup + routing precedence + `returnUrl` allowlist
- [ ] `is_admin` claim in the JWT via a Supabase auth hook
- [ ] Edge middleware admin branch

Added to **H9.5–H10.75**, the admin slot (~20 min):
- [ ] TOTP enrollment + `/auth/mfa` challenge screen
- [ ] `aal2` gate on the admin layout and admin API routes
- [ ] Studio ⇄ Admin switcher
- [ ] `seed-admin.ts` + demo admin account

If the schedule tightens, the cuttable piece is **TOTP** — it degrades to email-OTP-only
admin with a documented note, which is acceptable for a test-mode demo and not
acceptable for anything real. It is explicitly called out in the README's known
limitations if it gets cut. The routing, the layered authz, and the 404-not-403
behaviour do not get cut.
