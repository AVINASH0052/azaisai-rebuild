# 11 — Delivery Plan

12-hour window, deliberately generous, not expected to be fully used. Target: **the
Tier 0 spine demoable by hour 6**, Tier 1 differentiators by hour 9, polish and
submission by hour 11. Anything after that is buffer, not plan.

## Scheduling principles

1. **Deploy at hour 1.** The classic failure is a beautiful localhost app and a broken
   production build at hour 11.
2. **Vertical slices, not layers.** One thin end-to-end path (auth → generate → see a
   result) working early beats a perfect schema and no UI.
3. **Mock provider before real provider.** It de-risks the demo and makes the test
   loop milliseconds instead of minutes.
4. **Commit at every checkpoint**, code + `.agent-logs/` together. The commit graph is
   part of the submission ([00](00-AGENT-CAPTURE.md)).
5. **Every hour has a demoable artifact.** If we stopped at any hour boundary, there'd
   be something to show.

---

## H0 — Capture gate (blocking) · 30 min

- [ ] `git init`, public GitHub repo, `main`
- [ ] `scripts/agent-capture.mjs` + `.claude/settings.json` hooks
- [ ] Canary #1 in this session → verify PROMPT + RESPONSE in `.agent-logs/`
- [ ] Canary #2 in a **new** session → verify a second file lands
- [ ] `CAPTURE-TEST.md` written, including anything that failed first
- [ ] `.gitignore` — `.agent-logs/` **not** ignored; `.index.json` is

**Commit:** `chore: agent capture hooks + capture test`
**Gate:** nothing below starts until both canaries are green.

## H0.5–H1.5 — Skeleton live · 60 min

- [ ] `create-next-app` — TS strict, Tailwind v4, App Router, pnpm
- [ ] shadcn/ui init, design tokens from [08](08-DESIGN-UX.md)
- [ ] `lib/env.ts` (Zod, validates at boot), `lib/logger.ts`, `lib/errors.ts`
- [ ] Supabase project (prod + preview), Drizzle configured
- [ ] **Deploy to Vercel, custom domain, `/api/health` green in production**
- [ ] GitHub Actions: typecheck + lint + build

**Commit:** `feat: project skeleton, deployed`
**Demoable:** a live URL that returns a real page.

## H1.5–H2.5 — Data + auth · 60 min

- [ ] Full schema in Drizzle ([04](04-DATA-MODEL.md)): workspaces, members, profiles,
      credit_ledger (+ no-update/no-delete trigger), credit_grants, generations,
      generation_assets, share_links, subscriptions, audit_events, api_keys,
      job_outbox, analytics_events
- [ ] Migration generated + applied to both environments
- [ ] RLS policies as committed SQL; `current_workspace_ids()` stable function
- [ ] Supabase email OTP; `/auth/login`, `/auth/signup`, `/auth/callback`
- [ ] Signup trigger: create personal workspace + membership + 5-credit welcome grant
- [ ] Edge middleware: protect `(app)/*`, preserve `returnUrl`
- [ ] App shell: sidebar, topbar, live credit chip

**Commit:** `feat: schema, RLS, email OTP auth, app shell`
**Demoable:** sign in on the live URL, land in an empty studio with 5 credits.

## H2.5–H4 — Credits + provider abstraction + mock · 90 min

- [ ] `services/credits`: grant / debit / refund / balance / expire, all with row lock,
      idempotency keys, `balance_after`, audit rows
- [ ] **Unit tests: concurrent debit, refund idempotency, spend order, balance
      continuity** — this is the money, it gets tested before it gets a UI
- [ ] `providers/types.ts` — `ModelProvider` interface
- [ ] `providers/registry.ts` — all 12 models with capabilities + pricing from
      [01](01-PRODUCT-TEARDOWN.md) §5
- [ ] **`providers/mock`** — full state machine, real determinate progress,
      deterministic ~1-in-12 failure, curated asset pool
- [ ] `GET /api/models`, `POST /api/generations/quote`

**Commit:** `feat: credit ledger + provider abstraction + mock provider`
**Demoable:** ledger tests green; `/api/models` and quote endpoint live.

## H4–H6 — The pipeline · 120 min · **the critical path**

- [ ] `POST /api/generations` — validate → quote → tx(lock, debit, insert gen, insert
      outbox) → 202
- [ ] `services/generation.advance()` — CAS transitions, retries with backoff
- [ ] `/api/internal/worker/tick` + `vercel.json` cron (10s), `FOR UPDATE SKIP LOCKED`
- [ ] Artifact download → Supabase Storage → thumbnail → `generation_assets`
- [ ] Failure → refund in the same transaction
- [ ] Supabase Realtime subscription on `generations`
- [ ] Integration test: submit→ready and submit→fail→refund, against mock

**Commit:** `feat: generation pipeline — queue, worker, realtime, refunds`
**Demoable:** POST a generation, watch it walk the state machine live.

## H6–H7.5 — The studio · 90 min

- [ ] `ModelPicker`, `PromptComposer`, `ParamGroup` (capability-driven), `CostBar`
- [ ] `GenerationCard` × 5 states, `ProgressIndicator` × 3 kinds
- [ ] `ResultViewer` — player, download, share, rerun, delete
- [ ] `JobTray` — N concurrent, one filtered Realtime channel
- [ ] Keyboard: ⌘↵, ⌘K, 1–9, ⌥↑↓
- [ ] Empty / loading / error / offline states

**Commit:** `feat: video studio with parallel job tray`
**Demoable:** ← **the core loop works end to end on the live URL.** If everything
stops here, the submission is already viable.

## H7.5–H8.5 — Real providers + image studio · 60 min

- [ ] `providers/fal` — submit, poll, webhook parse, artifact resolve, cost capture
- [ ] `PROVIDER_MODE=auto` with daily spend ceiling + graceful degrade to mock
- [ ] Provider webhook endpoint
- [ ] Image studio (same components, image registry + style/aspect params)
- [ ] **Real image generation working on the live URL**

**Commit:** `feat: fal.ai provider + image studio`
**Demoable:** a stranger generates a real image and downloads it.

## H8.5–H9.5 — The differentiators · 60 min

- [ ] **Compare mode** — `POST /api/generations/batch`, synced `CompareView`
- [ ] **History** — grid, filters, prompt search, rerun, bulk actions
- [ ] **Share permalinks** — `/g/[shareId]` + dynamic `opengraph-image`
- [ ] **Credits ledger page** with expiry warnings and a visible refund row
- [ ] Prompt enhance/variate via Claude + preset palette

**Commit:** `feat: model comparison, history, share links, ledger`

## H9.5–H10.5 — Billing + landing + admin · 60 min

- [ ] Stripe products, Checkout, Billing Portal, webhooks (idempotent on event id)
- [ ] Pricing page with the original's ladder; test-card note for reviewers
- [ ] Landing page — hero, live public gallery, explainer, pricing, CTA
- [ ] `/admin` single read-only ops page
- [ ] Seed script: demo workspace, ~15 public generations, ledger with a refund

**Commit:** `feat: stripe billing, landing page, admin, seed data`

## H10.5–H11.5 — Hardening & polish · 60 min

- [ ] Playwright E2E happy path green in CI
- [ ] axe a11y pass on 5 routes; fix contrast/focus/roles
- [ ] Security pass ([09](09-SECURITY.md) checklist) — RLS verified by query, anon
      client tested, service key absent from the bundle, headers grade A
- [ ] Mobile pass at 375px on every screen
- [ ] Lighthouse: landing ≥ 95 perf, ≥ 95 a11y
- [ ] Error copy review — every error code has a specific message + recovery action
- [ ] README: what it is, architecture diagram, local setup, env vars, decisions

**Commit:** `chore: hardening, a11y, security pass, README`

## H11.5–H12 — Submission · 30 min

- [ ] Rotate any key that could have been exposed
- [ ] Final `.agent-logs/` commit; verify unedited and complete
- [ ] Verify live link **in a fresh incognito window, signed out**
- [ ] Verify repo is public and `.agent-logs/` is browsable on GitHub
- [ ] Record walkthrough — camera on, < 5 min (script below)
- [ ] Submit: walkthrough field, live link + repo link labelled

---

## Walkthrough script (target 4:30)

| Time | Beat |
|---|---|
| 0:00–0:30 | Camera on. What azaisai.com is, the core loop I identified, the one-line thesis: rebuild the loop properly, build foundations for the orbit. |
| 0:30–1:00 | Product judgement: what I cut (reposter, 11 admin routes, phone wall, 6 locales, 3 analytics vendors) and why. This is the highest-signal 30 seconds. |
| 1:00–2:00 | Live: sign in with an email code, generate a real image, download it. |
| 2:00–3:00 | **Compare mode** — one prompt, three models, fired in parallel, honest per-stage progress. Contrast with the original's fake 95% bar. |
| 3:00–3:40 | A generation fails → the ledger shows the automatic refund. Trust, demonstrated not claimed. |
| 3:40–4:10 | Share permalink + unfurl. The growth loop the original is missing. |
| 4:10–4:30 | Architecture in one diagram: append-only ledger, workspace-keyed rows, provider abstraction with a mock, transactional outbox. What that buys in month six. |

## Cut order under time pressure

If behind schedule, drop in this order — decided **now**, so it's not decided badly
at hour 10:

1. `/admin` page
2. Prompt enhance/variate (keep presets)
3. Stripe (keep the pricing page; note test mode not wired)
4. History filters (keep the grid + rerun)
5. Image studio (video alone proves the loop)

Never cut: capture logging, the ledger, the honest progress state machine, compare
mode, share links, the mock provider, or the a11y/security pass. Those are the
submission's actual argument.
