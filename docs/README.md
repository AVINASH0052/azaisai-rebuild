# AzaisAI Rebuild — Planning Docs

Rebuild of [azaisai.com](https://azaisai.com) for the 8x engineering assignment.
This folder is the complete plan, written **before** any application code.

## Reading order

| # | Doc | What it settles |
|---|-----|-----------------|
| 00 | [Agent capture setup](00-AGENT-CAPTURE.md) | The blocking gate. `.agent-logs/` must work before we build. |
| 01 | [Product teardown](01-PRODUCT-TEARDOWN.md) | What the original actually is — routes, models, pricing, stack, flows. |
| 02 | [Scope & priorities](02-SCOPE.md) | What we build, what we cut, and why. The product-judgement doc. |
| 03 | [Architecture](03-ARCHITECTURE.md) | Stack, layering, module boundaries, deployment topology. |
| 04 | [Data model](04-DATA-MODEL.md) | Postgres schema, RLS, ledger design, migrations. |
| 05 | [API contract](05-API-CONTRACT.md) | Every endpoint, request/response shape, error taxonomy. |
| 06 | [Generation pipeline](06-GENERATION-PIPELINE.md) | The hard part: async jobs, provider adapters, realtime, refunds. |
| 07 | [Credits & billing](07-CREDITS-BILLING.md) | Ledger semantics, Stripe, plans, top-ups, cost guardrails. |
| 08 | [Design system & UX](08-DESIGN-UX.md) | Visual language, component inventory, the screens, motion, a11y. |
| 09 | [Security & compliance](09-SECURITY.md) | Threat model, authz matrix, abuse controls, secrets, privacy. |
| 10 | [Observability & ops](10-OBSERVABILITY-OPS.md) | Logging, metrics, tracing, alerts, runbooks, CI/CD. |
| 11 | [Delivery plan](11-DELIVERY-PLAN.md) | Hour-by-hour execution schedule with commit checkpoints. |
| 12 | [Decisions & risks](12-DECISIONS-RISKS.md) | ADRs and the risk register with mitigations. |
| 13 | [Submission checklist](13-SUBMISSION.md) | Exactly what gets handed in and how it's verified. |
| 14 | [Admin dashboard & limits engine](14-ADMIN-DASHBOARD.md) | The control plane: per-client limits, enforcement, automated rules, admin authz. Supersedes the `/admin` cut in 02. |
| 15 | [Git workflow](15-GIT-WORKFLOW.md) | How work lands on `main`, why trunk-based, and how `.agent-logs/` interleaves with commits. |
| 16 | [Auth & routing](16-AUTH-AND-ROUTING.md) | One landing page, one sign-in form; admins route to `/admin`, everyone else to the studio. Step-up MFA, admin bootstrapping, demo access. |

`research/` holds the raw artefacts the teardown was derived from (saved HTML,
extracted JS config, screenshots).

## The one-paragraph version

AzaisAI is a credit-metered, multi-provider AI video and image generation studio.
A user signs in with an email code, gets a small free credit grant, picks one of
~12 models, writes a prompt, spends credits, waits ~30–90s, and downloads an MP4
or PNG. Everything else on the site — pricing, referrals, admin dashboards, a
"reposter" affiliate program, six locales, eleven currencies — orbits that loop.
We rebuild **the loop** to a higher standard than the original, on foundations
(typed schema, append-only credit ledger, provider abstraction, job queue,
realtime, RLS, audit log) that make the orbit cheap to add later.

## Non-negotiables from the brief

1. Live link works for a logged-out stranger.
2. Public repo with `.agent-logs/` committed **as we go**, not in one dump.
3. Walkthrough video, camera on, under five minutes.
4. Judged on: speed, product judgement, UX/UI.
