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
4. **Commit at every checkpoint**, code + `.agent-logs/` together, always as
   `git add -A && git commit && git push` — directly to `main`, never squashed.
   The commit graph is part of the submission ([00](00-AGENT-CAPTURE.md),
   [15](15-GIT-WORKFLOW.md)).
5. **Every hour has a demoable artifact.** If we stopped at any hour boundary, there'd
   be something to show.

---

## H0 — Capture gate (blocking) · 30 min

- [ ] `git init`, public GitHub repo, `main` as the working branch
      (trunk-based, no branch protection — [15](15-GIT-WORKFLOW.md))
- [ ] husky pre-commit (typecheck + lint + gitleaks on staged) and pre-push (unit)
- [ ] `scripts/agent-capture.mjs` + `.claude/settings.json` hooks
- [ ] Canary #1 in this session → verify PROMPT + RESPONSE in `.agent-logs/`
- [ ] Canary #2 in a **new** session → verify a second file lands
- [ ] `CAPTURE-TEST.md` written, including anything that failed first
- [ ] `.gitignore` — `.agent-logs/` **not** ignored; `.index.json` is

**Commit:** `chore: agent capture hooks + capture test`
**Gate:** nothing below starts until both canaries are green.

## H0.25 — Free-tier reality check (blocking) · 20 min

Seven API calls, before any application code. Each answer changes the plan if it comes
back worse than assumed ([18](18-FREE-TIER-STACK.md) §Verification).

- [ ] **Veo on the Gemini free tier** — available? daily/per-minute limits?
- [ ] **Veo image→video seeding** — does the `image` param work free?
      ← **decides whether long-form video is buildable at all** ([19](19-LONG-VIDEO.md))
- [ ] Veo output — duration, resolution, codec, container, audio?
      ← decides whether `ffmpeg concat -c copy` works without re-encoding
- [ ] Gemini Flash Image + Gemini Flash text — RPM/RPD
- [ ] Cloud Run — deploy a hello-world container with ffmpeg, confirm $0
- [ ] Supabase Free — confirm current storage/egress allowances

**Commit:** `docs: free-tier findings` (with `docs/research/FREE-TIER-FINDINGS.md`)
**Gate:** the fallback for each bad outcome is pre-decided in
[18](18-FREE-TIER-STACK.md) §2 and [19](19-LONG-VIDEO.md) §Cut fallback. Take the
fallback, don't replan.

## H0.5–H1.5 — Skeleton live · 60 min

- [ ] **pnpm workspace monorepo from commit one** ([17](17-BACKEND-SERVICES.md)):
      `apps/web` + `packages/{core,db,providers,contracts,config}`.
      `apps/api` and `apps/worker` stay empty until later — 15 min now, over an
      hour if deferred to H10.
- [ ] `create-next-app` in `apps/web` — TS strict, Tailwind v4, App Router, pnpm
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
- [ ] **Role-based routing** ([16](16-AUTH-AND-ROUTING.md)): `/auth/callback` looks up
      `platform_admins` → `/admin`, else `/studio/video`; `returnUrl` allowlist;
      `is_admin` JWT claim via auth hook
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
- [ ] **`generation_segments`** + parent columns; sequential chained orchestration;
      partial-failure and per-segment refund ([19](19-LONG-VIDEO.md)) · +30 min

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

## H7.5–H9 — Google provider + long video + image studio · 90 min

- [ ] `providers/google` — Veo long-running ops, Gemini Flash Image, poll → artifact
- [ ] `PROVIDER_MODE=auto` with **daily quota ceiling** + graceful degrade to mock
- [ ] Gemini Flash **scene decomposition** → `storyboard` ([19](19-LONG-VIDEO.md))
- [ ] Veo **image→video seeding** for chained segments
- [ ] **Cloud Run worker container with ffmpeg**: last-frame extract, concat,
      audio seam, trim, thumbnail
- [ ] Image studio (same components, image registry + style/aspect params)
- [ ] **Real image generation working on the live URL**

**Commit:** `feat: google provider, long-form video pipeline, image studio`
**Demoable:** a stranger generates a real image; a 20s video stitches from 3 segments.

## H9–H10 — The differentiators · 60 min

- [ ] **Storyboard editor** — per-segment status, inline beat editing, single-segment
      regenerate with its cost stated ([19](19-LONG-VIDEO.md)) · **replaces compare
      mode as the headline**
- [ ] **History** — grid, filters, prompt search, rerun, bulk actions
- [ ] **Share permalinks** — `/g/[shareId]` + dynamic `opengraph-image`
- [ ] **Credits ledger page** with expiry warnings and a visible refund row
- [ ] Prompt enhance/variate via **Gemini Flash** + preset palette

**Commit:** `feat: storyboard editor, history, share links, ledger`

## H10–H11.25 — Admin control plane · 75 min · see [14](14-ADMIN-DASHBOARD.md)

- [ ] `platform_admins` (separate authz plane), `plan_policies`, `workspace_policies`,
      `platform_settings`, `admin_actions` + RLS
- [ ] `resolvePolicy()` — layer, clamp, cache, `source` tracking
- [ ] Enforcement wired at all four points (middleware, submit, debit, upload)
- [ ] Client-side limit messaging: specific errors, reset times, queue-don't-reject
- [ ] `/admin` overview + `/admin/workspaces` list
- [ ] `/admin/workspaces/[id]` — **limits editor with source column + preview diff**
- [ ] Audit row on every admin write; reason required
- [ ] **Quota** circuit breaker (per-workspace + platform) — degrade to mock
- [ ] TOTP enrollment + `/auth/mfa`; `aal2` gate on the admin layout and API routes
- [ ] Studio ⇄ Admin switcher; `seed-admin.ts` + read-only demo admin
      ([16](16-AUTH-AND-ROUTING.md))

**Commit:** `feat: limits engine + admin control plane`
**Demoable:** cap a customer's daily spend live, watch enforcement + the audit trail.

## H11.25–H12 — Billing + landing + seed · 45 min

- [ ] Stripe products, Checkout, Billing Portal, webhooks (idempotent on event id)
- [ ] Pricing page with the original's ladder; test-card note for reviewers
- [ ] Landing page — hero, live public gallery, explainer, pricing, CTA
- [ ] Seed script: demo workspace, ~15 public generations, ledger with a refund,
      one workspace carrying a visible limit override

**Commit:** `feat: stripe billing, landing page, seed data`

## H12–H12.75 — Hardening & polish · 45 min

- [ ] Playwright E2E happy path green in CI
- [ ] axe a11y pass on 5 routes; fix contrast/focus/roles
- [ ] Security pass ([09](09-SECURITY.md) checklist) — RLS verified by query, anon
      client tested, service key absent from the bundle, headers grade A
- [ ] Mobile pass at 375px on every screen
- [ ] Lighthouse: landing ≥ 95 perf, ≥ 95 a11y
- [ ] Error copy review — every error code has a specific message + recovery action
- [ ] README: what it is, architecture diagram, local setup, env vars, decisions

**Commit:** `chore: hardening, a11y, security pass, README`

## H12.75–H13.25 — Submission · 30 min

> Everything below this line is **post-submission-critical**. If the window ends here,
> the product is complete and shipped.

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
| 0:30–1:00 | Product judgement: what I cut (reposter, 10 of 11 admin routes, phone wall, 6 locales, 3 analytics vendors) and why — plus the $0 constraint and what it forced. Highest-signal 30 seconds. |
| 1:00–2:00 | Live: sign in with an email code, generate a real image, download it. |
| 2:00–3:00 | **The headline: a 20s video from an 8s model.** Show the storyboard Gemini planned, edit a beat, generate. Explain last-frame chaining while segment 2 runs. Honest "segment 2 of 3" progress vs the original's fake 95% bar. |
| 3:00–3:40 | A segment fails → partial delivery + a per-segment refund in the ledger. Trust, demonstrated not claimed. |
| 3:40–4:00 | Share permalink + unfurl. The growth loop the original is missing. |
| 4:00–4:30 | Admin: cap a customer's daily spend live, show the resolved policy with its `source` column and the audit row. Then one architecture slide — append-only ledger, workspace-keyed rows, provider abstraction with a mock, transactional outbox. What that buys in month six. |

## Post-submission — Phase 2

Deferred by design ([17](17-BACKEND-SERVICES.md) §Phase 2): extract `apps/api` for the
public `/v1` surface and webhooks. Two deploy targets and a network hop, for benefits
that don't show up at demo scale.

Note that **Phase 1 is no longer deferred** — the free-tier rework moved the worker onto
Cloud Run at H7.5–H9, because ffmpeg for long-form video cannot run on Vercel at all
([18](18-FREE-TIER-STACK.md)). R4 closes inside the window rather than after it.

## Schedule honesty

Three rounds of additions pushed the nominal end past the window, stated rather than
hidden:

| Addition | Cost | Running end |
|---|---|---|
| Admin control plane ([14](14-ADMIN-DASHBOARD.md)) | +75 min | H12.75 |
| Free-tier verification gate ([18](18-FREE-TIER-STACK.md)) | +20 min | H13 |
| Long-form video ([19](19-LONG-VIDEO.md)) | +105 min | **H13.25** |
| *(offset)* compare mode → Tier 2 | −30 min | |
| *(offset)* worker no longer a separate phase | −75 min | |

**Submission completes at H13.25** — about 75 minutes over. The offsets are real: long
video displaced compare mode as the headline differentiator, and the Cloud Run worker
absorbed what was a separate post-submission phase.

The monorepo layout at H1 is not optional — 15 minutes there, over an hour at H10.

The buffer between H11 and H12 is long gone, so anything that slips comes out of the cut
list rather than out of the deadline. If H6.5 arrives with the pipeline unfinished, cuts
1 and 2 fire immediately rather than at H11.

## Cut order under time pressure

Decided **now**, so it's not decided badly at hour 12:

1. Prompt enhance/variate (keep the preset palette and the scene decomposer — the
   decomposer is load-bearing for long video, the rewrite button isn't)
2. Admin Tier B — the generations inspector and model toggles
   ([14](14-ADMIN-DASHBOARD.md) §10). Tier A stays.
3. Stripe (keep the pricing page; note test mode not wired)
4. History filters (keep the grid + rerun)
5. **Long video beyond 16s** — ship 2-segment chaining, defer 3–4 segments. Proves the
   mechanism at half the quota cost.
6. Image studio (video alone proves the loop)

Never cut: capture logging, the ledger, the honest progress state machine, long-form
chaining (at least 2 segments), share links, the mock provider, the limits engine +
enforcement, or the a11y/security pass. Those are the submission's actual argument.

Two ordering changes worth noting. **Admin Tier A outranks prompt enhance and Stripe** —
a limits control plane demonstrates more engineering judgement in five minutes than an
LLM rewrite button does. And **compare mode dropped to Tier 2** entirely: on a free tier
it multiplies quota consumption for a demo that long-form video now makes better.
