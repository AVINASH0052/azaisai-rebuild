# 03 — Architecture

## Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15, App Router, TypeScript strict** | Same as the original, so parity is cheap. RSC keeps the studio shell on the server and the interactive rail on the client. One deploy target for UI + API. |
| Runtime | Node 20 on Vercel (serverless fns) + Edge middleware for auth gating | Edge for the cheap redirect check, Node for anything touching the DB or providers. |
| Styling | **Tailwind v4 + shadcn/ui + Radix primitives** | Matches the original's idioms exactly (`cn()`, `oklch()` tokens, `rounded-2xl border-border/60`). Radix gives a11y for free. |
| DB | **Supabase Postgres** | Same as original. Postgres, RLS, Realtime, Storage, and Auth in one box is the correct 12-hour trade. |
| ORM / migrations | **Drizzle** | Typed schema as code, SQL-first migrations checked into the repo. Supabase's JS client alone gives no migration story, and "solid foundation" means migrations exist from commit one. |
| Auth | **Supabase Auth**, email OTP | Passwordless, matches original UX, no password storage to get wrong. |
| Object storage | **Supabase Storage** (private buckets + signed URLs) | Colocated with the DB, RLS-aware. |
| Realtime | **Supabase Realtime** (Postgres CDC on `generations`) | Replaces the original's polling. Status changes push to the client because the row changed — no separate pub/sub to keep consistent with the DB. |
| Background work | **DB-backed queue + Vercel Cron worker + provider webhooks** | See [06](06-GENERATION-PIPELINE.md). No extra infra to provision. |
| Payments | **Stripe** Checkout + Billing Portal + webhooks | Test mode for the demo. Webhook-driven grants, never client-trusted. |
| Model providers | **fal.ai** primary, adapter layer over it | One key, one billing relationship, most of the catalogue (Veo, Sora-class, Runway-class, nano-banana, flux). Direct OpenAI/Google/Runway keys need per-vendor onboarding we don't have 12 hours for. See [ADR-005](12-DECISIONS-RISKS.md). |
| LLM (prompt enhance) | **Claude** (`claude-sonnet-5`) | Fast, cheap, good at prompt rewriting. |
| Validation | **Zod**, one schema per boundary, shared client↔server | Single source of truth for form validation and API validation. |
| Testing | Vitest (unit) + Playwright (one E2E happy path) | The E2E is what proves the loop for the walkthrough. |
| Hosting | **Vercel** | Same as original. Preview deploys per PR. |

## Layering

> **Superseded in part by [17](17-BACKEND-SERVICES.md).** The layers below are correct;
> their *physical* home is a pnpm workspace from commit one — `apps/web` plus
> `packages/{core,db,providers,contracts,config}` — so that extracting an always-on
> worker later is a folder move rather than a rewrite. The `src/` tree shown here maps
> onto `apps/web` + `packages/*`.

Strict dependency direction. Nothing points back up.

```
┌──────────────────────────────────────────────────────────────┐
│  app/          Next.js routes — RSC pages, route handlers     │
│                Thin. Parse, authorise, call a service, render.│
├──────────────────────────────────────────────────────────────┤
│  features/     Feature modules (studio, history, credits,     │
│                billing, share). UI + hooks + local state.     │
├──────────────────────────────────────────────────────────────┤
│  services/     Business logic. Transaction boundaries live    │
│                here. Pure of HTTP and of React.               │
│                generation · credits · billing · workspace     │
├──────────────────────────────────────────────────────────────┤
│  providers/    Model provider adapters behind one interface.  │
│                fal · mock · (openai · google · runway later)  │
├──────────────────────────────────────────────────────────────┤
│  db/           Drizzle schema, migrations, typed queries      │
├──────────────────────────────────────────────────────────────┤
│  lib/          Cross-cutting: auth, logger, errors, env, rate │
│                limit, ids, money, result types                │
└──────────────────────────────────────────────────────────────┘
```

**The rule that keeps this honest:** a route handler may not import from `db/`.
It calls a service. Services own transactions. This is what makes the same logic
reusable behind the public API, the cron worker, and the web app without three copies
of the credit-deduction rules.

## Directory layout

```
.
├── .agent-logs/                    # committed. see docs/00
├── .claude/settings.json           # capture hooks
├── CAPTURE-TEST.md
├── docs/                           # this folder
├── scripts/
│   ├── agent-capture.mjs
│   ├── seed.ts                     # demo workspace + public gallery
│   └── capture-screenshots.ts      # Playwright, for docs/research
├── drizzle/                        # generated SQL migrations, committed
├── src/
│   ├── app/
│   │   ├── (marketing)/            # landing, pricing, faq, about  — public, static
│   │   ├── (auth)/auth/…           # login, signup, check-email, callback
│   │   ├── (app)/                  # authed shell: sidebar + topbar + credit chip
│   │   │   ├── studio/[mode]/      # mode = video | image  (one studio, two configs)
│   │   │   ├── history/
│   │   │   ├── credits/
│   │   │   ├── settings/
│   │   │   └── admin/
│   │   ├── g/[shareId]/            # public share permalink + opengraph-image
│   │   └── api/
│   │       ├── v1/                 # public API surface (same handlers)
│   │       ├── generations/
│   │       ├── credits/
│   │       ├── billing/
│   │       ├── prompt/
│   │       ├── internal/worker/    # cron-invoked, secret-guarded
│   │       └── webhooks/{stripe,provider}/
│   ├── features/
│   │   ├── studio/                 # the big one
│   │   ├── job-tray/
│   │   ├── history/
│   │   ├── credits/
│   │   └── share/
│   ├── services/
│   │   ├── generation/             # submit, advance, finalize, fail, refund
│   │   ├── credits/                # ledger ops. the only place money moves.
│   │   ├── billing/
│   │   └── workspace/
│   ├── providers/
│   │   ├── types.ts                # ModelProvider interface
│   │   ├── registry.ts             # model catalogue, single source of truth
│   │   ├── mock/
│   │   └── fal/
│   ├── db/
│   │   ├── schema/                 # one file per aggregate
│   │   └── client.ts
│   ├── lib/
│   └── components/ui/              # shadcn
├── e2e/
└── supabase/                       # RLS policies as SQL, committed
```

## The provider abstraction

The single most important interface in the codebase, because it's what makes the
model catalogue data instead of code.

```ts
// providers/types.ts
export interface ModelProvider {
  readonly id: string;

  /** Submit work. Must be idempotent on idempotencyKey. */
  submit(req: GenerationRequest, ctx: SubmitCtx): Promise<ProviderHandle>;

  /** Poll. Only called for providers without webhook support. */
  poll(handle: ProviderHandle): Promise<ProviderStatus>;

  /** Translate an inbound webhook into a status. Optional. */
  parseWebhook?(payload: unknown, sig: string): ProviderStatus;

  /** Where the finished artifact lives, so we can copy it to our storage. */
  resolveArtifacts(status: ProviderStatus): Promise<Artifact[]>;
}

export type ProviderStatus =
  | { state: "queued" }
  | { state: "processing"; pct?: number; stage?: string }
  | { state: "succeeded"; artifacts: ArtifactRef[] }
  | { state: "failed"; code: FailureCode; message: string; billable: boolean };
```

`FailureCode` is a closed union — `content_policy | provider_error | timeout |
invalid_input | quota_exceeded | cancelled`. `billable` is what drives the refund
decision, and it lives in the adapter because only the adapter knows whether the
vendor charged us. This is the detail that makes "credits are never charged for
failed generations" a property of the system rather than a promise in a FAQ.

### Model registry

```ts
// providers/registry.ts — one entry per user-visible model
{
  id: "veo-3-fast",
  label: "Veo 3 Fast",
  vendor: "google",
  kind: "video",
  provider: "fal",
  providerModel: "fal-ai/veo3/fast",
  badge: "fast",
  credits: { per: "second", rate: 1.5 },
  capabilities: {
    audio: true, imageToVideo: true,
    durations: [4, 6, 8], aspects: ["16:9", "9:16"], resolutions: ["720p"],
  },
  estimatedSeconds: 35,
  availability: "live",          // live | mock_only | disabled
}
```

Adding a model is a registry entry. Cost estimation, the picker UI, param validation,
and the capability gating all read from here. The original clearly has something
equivalent; making it explicit and typed is the scalability story.

## Multi-tenancy

**Every row is keyed on `workspace_id`, never `user_id`.** A personal workspace is
created on signup and the user is its owner. The UI never mentions workspaces in v1.

This is a two-line decision now and a migration nightmare later. It's the single
clearest example of "foundation so it can always be scalable": teams, seat billing,
shared credit pools, and org-level RLS all become additive.

RLS policies are written against workspace membership from the start:

```sql
create policy "members read own workspace generations"
on generations for select
using (workspace_id in (
  select workspace_id from workspace_members where user_id = auth.uid()
));
```

## Request flow, annotated

**Generate (write path):**
```
Client → POST /api/generations              [Zod validate, Turnstile on first-of-session]
       → withAuth() → resolve workspace + role
       → rateLimit(workspace, "generate")
       → generationService.submit()
           ├─ registry.lookup(modelId)             → validate params vs capabilities
           ├─ pricing.quote(model, params)         → integer credits
           ├─ BEGIN TX
           │    ├─ credits.debit(ws, cost, ref)    → ledger row, balance check, SELECT FOR UPDATE
           │    ├─ insert generations(status=queued, idempotency_key)
           │    └─ insert audit_events
           │  COMMIT
           └─ enqueue job (same TX via outbox row)
       → 202 { id, status: "queued", estimatedSeconds }
Client subscribes to Realtime on generations:id
```

**Advance (worker path):** cron every 10s + webhook → `generationService.advance(id)`
→ provider `submit`/`poll` → on success, download artifact → upload to Storage →
generate thumbnail → `status=ready` → row update fires Realtime → client renders.
On failure with `billable:false` → `credits.refund()` in the same transaction.

Full state machine, retry policy, and failure taxonomy: [06](06-GENERATION-PIPELINE.md).

## Deployment topology

```
              ┌── Vercel Edge (middleware: session check, locale, redirects)
Browser ──────┤
              └── Vercel Node fns ──┬── Supabase Postgres  (RLS)
                    ▲               ├── Supabase Storage   (private + signed URLs)
                    │               ├── Supabase Realtime  ──► push to browser
   Vercel Cron ─────┤               ├── fal.ai             (model providers)
   (*/10s worker)   │               ├── Stripe             (checkout + portal)
                    │               └── Anthropic          (prompt enhance)
   Provider webhook ┘
```

Environments: `production` (custom domain), `preview` (per PR, separate Supabase
project, Stripe test mode, mock provider forced on), `local` (Supabase CLI, mock
provider default).

## Performance budget

| Surface | Target |
|---|---|
| Landing LCP (cold, 4G) | < 1.8s |
| Studio TTI | < 1.5s |
| `POST /api/generations` p95 | < 400ms (it returns 202 immediately; provider call is the worker's job) |
| Realtime status → paint | < 250ms |
| Studio JS bundle | < 180KB gzip |

The submit endpoint returning `202` before touching a provider is the key move: the
user's click never waits on fal.ai. The original's does.
