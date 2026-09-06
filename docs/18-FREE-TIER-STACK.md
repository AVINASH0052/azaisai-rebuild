# 18 — Free-Tier Stack

**Constraint: everything runs on free tiers. Total spend $0.** Generation is Google AI
Studio (Gemini API). Cloudflare is available but held back as a fallback.

This supersedes the provider choice in [ADR-005](12-DECISIONS-RISKS.md), the Railway
deployment in [17](17-BACKEND-SERVICES.md), and the spend-cap model in
[07](07-CREDITS-BILLING.md). Most of the architecture survives untouched — which is the
payoff for putting providers behind an adapter and money behind a ledger.

---

## What changes

| Was | Now | Why |
|---|---|---|
| fal.ai, pay-as-you-go | **Google AI Studio / Gemini API** free tier | the constraint |
| ~12 models across 3 vendors | **Veo** (video), **Gemini Flash Image** (image), **Gemini Flash** (text) | one vendor is what's free |
| Railway for `api` + `worker` | **Google Cloud Run** free tier | genuinely free, runs containers, scales to zero, 60-min request timeout |
| Daily spend cap in **cents** | Daily budget in **API quota units** | there is no bill; the ceiling is requests/day |
| Stripe live | **Stripe test mode** | test mode is free forever — keep it, the money path still demos |
| Supabase Pro | **Supabase Free** | 500MB DB, 1GB storage, 50k MAU |
| Vercel Pro | **Vercel Hobby** | 100GB bandwidth, 60s functions |

## The stack

| Layer | Service | Free allowance | Binding limit |
|---|---|---|---|
| Web | Vercel Hobby | 100GB bandwidth/mo, 60s fn | non-commercial use only |
| DB + Auth + Realtime | Supabase Free | 500MB DB, 50k MAU | **pauses after 7 days idle** |
| Object storage | Supabase Storage | **1GB, 5GB egress** | ← the real ceiling |
| Video / image / text gen | Gemini API (AI Studio) | per-model RPM + RPD | **Veo daily quota** |
| Pipeline worker + ffmpeg | Google Cloud Run | 180k vCPU-s, 360k GiB-s, 2M req | comfortable |
| Scheduling | Cloud Scheduler | 3 jobs free | fine (we need 2) |
| Payments | Stripe test mode | unlimited | not real money |
| Errors | Sentry free | 5k events/mo | fine |

## The binding constraints, ranked

### 1. Storage and egress — the one that bites first

Supabase Free gives **1GB storage and ~5GB egress**. An 8s 720p Veo clip is roughly
5–10MB; a stitched 20s video is 15–25MB. That's **40–80 videos before storage is full**,
and egress dies sooner if videos get replayed — every preview loop is a download.

Mitigations, in order:

1. **Never serve video through Vercel.** Signed URLs point directly at storage, so
   Vercel's 100GB bandwidth is never touched by media.
2. **Aggressive retention:** free-tier generations are deleted after 7 days, stated
   plainly in the UI at generation time. Demo/seed assets are exempt and pinned.
3. **Store one artifact, not five.** Keep the stitched output + a thumbnail. Intermediate
   segments are deleted once the stitch succeeds ([19](19-LONG-VIDEO.md)).
4. **Thumbnails as WebP**, ~30KB, and history grids show thumbnails with hover-to-play
   only on intent — not autoplaying a grid of MP4s.
5. **Escape hatch: Cloudflare R2** — see §Cloudflare below.

### 2. Veo quota — **the #1 assumption to verify before building**

> **Unverified.** I do not have current, reliable knowledge of whether Veo video
> generation is available on the Gemini API **free** tier, or at what daily limit.
> Historically AI Studio has allowed limited free Veo generation in the web UI while
> API access to Veo has been billed. My knowledge cutoff makes this exactly the kind of
> fast-moving detail I should not assert.

**This is load-bearing and gets checked first, before any code** — H0.25, one API call
against the free key. Three outcomes, all planned for:

| Outcome | Plan |
|---|---|
| Veo available free, workable daily quota | proceed as written |
| Veo available free, very tight quota (e.g. a handful/day) | video becomes **demo-gated**: real generation for the first N/day globally, mock provider after, badge shown. Images stay real and unlimited-ish. |
| Veo not available free at all | **images real, video mock.** The entire pipeline — segments, chaining, stitching, ledger, refunds — still runs end to end against the mock provider, using a curated clip pool. The walkthrough is unaffected; the README says so plainly. |

The mock provider ([ADR-006](12-DECISIONS-RISKS.md)) was built first precisely so this
outcome is a config flag rather than a crisis. That decision now looks like the most
valuable one in the plan.

### 3. Supabase free projects pause after ~7 days idle

A paused project means the reviewer opens a dead link a week later. **Mitigation:** a
Cloud Scheduler job pings `/api/health` every 6 hours, which keeps the project warm and
doubles as an uptime check. Costs nothing, one of the 3 free scheduler slots.

### 4. Vercel Hobby is non-commercial

Fine for an assignment/portfolio piece. Noted in the README so it isn't a surprise.

## Gemini API integration

One adapter, `providers/google`, implementing the existing `ModelProvider` interface —
no changes to `packages/core`.

| Use | Model | Notes |
|---|---|---|
| Video | Veo (via `generateVideos`, long-running op) | 8s clips, 720p, 16:9 / 9:16. Poll the operation name. |
| Image→video | Veo with an `image` seed | **This is what makes long-form work** ([19](19-LONG-VIDEO.md)) |
| Image | Gemini Flash Image | fast, cheap, generous free quota |
| Prompt enhance / variate | Gemini Flash | replaces Claude — one vendor, one key |
| **Scene decomposition** | Gemini Flash | the storyboard planner for long videos |

Veo returns a **long-running operation**, not a synchronous result — poll until done,
then fetch the file. That maps cleanly onto the existing state machine:
`submitted → processing → downloading → ready`.

**Model registry shrinks** ([03](03-ARCHITECTURE.md)): ~4 real entries instead of 12.
The picker still renders a catalogue; unavailable vendors are shown as
`availability: "mock_only"` with an honest badge rather than hidden. Pretending to
offer Sora and Runway we can't call would be the dishonest option.

## Quota as a first-class resource

With no bill, the ceiling is **requests per day**, and one enthusiastic visitor can
consume the entire platform's daily video quota in ten minutes. The limits engine from
[14](14-ADMIN-DASHBOARD.md) stops being a nice-to-have and becomes the thing that keeps
the demo alive.

Reworked limits for free-tier reality:

| Limit | Free (everyone) | Demo admin |
|---|---|---|
| `video.per_day` per workspace | 2 | — |
| `long_video.per_day` per workspace | 1 | — |
| `images.per_day` per workspace | 15 | — |
| `generations.concurrent` | 1 | — |
| **platform** `veo.requests_per_day` | tracked against the real quota | — |
| Behaviour at platform ceiling | **degrade to mock, badge shown** | — |

`spend.daily_cents` becomes `quota.daily_requests` — same engine, same clamping, same
audit, different unit. The circuit breaker flips `PROVIDER_MODE` to mock for the rest of
the UTC day instead of capping a dollar figure.

**Quota accounting counts generated segments, not delivered seconds.** A 20s video is
3 Veo calls and is debited as 3 ([19](19-LONG-VIDEO.md)).

## Where the worker runs

**Google Cloud Run**, not Railway:

- Genuinely free at our volume (180k vCPU-seconds/month; a stitch job is ~30 vCPU-s).
- Runs a **container**, so `ffmpeg` is a `apt-get install` — this is non-negotiable for
  long-form video and impossible on Vercel.
- **Request timeout up to 60 minutes**, versus Vercel's 60 seconds. Closes R4 outright.
- Scales to zero — no idle cost, no idle process.
- Same Google account as the Gemini key.

Invocation: `apps/web` calls the Cloud Run URL when a job is enqueued (fire-and-forget),
and **Cloud Scheduler** hits it every minute as the safety net that catches anything
dropped. Authentication is a Google service-account OIDC token, so the endpoint isn't
publicly invokable.

`apps/api` from [17](17-BACKEND-SERVICES.md) stays deferred. The worker is the only
extraction that earns its keep.

## Cloudflare — what it's actually for

Held as a fallback per your steer, with one honest caveat.

| Need | Cloudflare option | Verdict |
|---|---|---|
| **Video storage + egress** | **R2** — 10GB storage, **zero egress fees**, 1M writes/mo | ⚠️ **Not really a last resort.** Supabase's 1GB/5GB is the single tightest constraint in this stack, and for a video product egress is what kills you. R2 is ~10× the room with no egress ceiling. |
| Web hosting if Vercel limits bite | Pages | solid fallback, no reason to switch first |
| Rate limiting / bot defence at the edge | WAF free tier | worth turning on regardless, it's free |
| Video encoding / delivery | Stream | paid — not an option here |

**My recommendation:** keep Supabase Storage as planned for v1, because the storage
adapter is one interface and swapping it is ~30 minutes. But if you'd like the demo to
survive more than ~50 videos, switching video assets to R2 is the highest-value use of
the Cloudflare account you have, and it isn't really a fallback — it's the only free
option that survives contact with video. Your call; both are one config away.

Turning on the Cloudflare WAF in front of the domain is free and I'd do it regardless.

## Verification checklist — before writing any application code

Run at **H0.25**, immediately after the capture gate. Each is one API call.

- [ ] **Veo on the free tier**: available? daily/per-minute limits? → decides video reality
- [ ] **Veo image→video seeding**: does the `image` parameter work on the free tier?
      → **decides whether long-form video is possible at all** ([19](19-LONG-VIDEO.md))
- [ ] Veo output: exact duration, resolution, codec, container, audio present?
      → decides whether `ffmpeg concat -c copy` works without re-encoding
- [ ] Gemini Flash Image: RPM/RPD limits
- [ ] Gemini Flash text: RPM/RPD (used for enhance + scene planning)
- [ ] Cloud Run: deploy a hello-world container with ffmpeg, confirm free-tier billing
- [ ] Supabase Free: confirm storage/egress numbers on the current plan

Findings go in `docs/research/FREE-TIER-FINDINGS.md`, committed. Anything that comes
back worse than assumed triggers the corresponding fallback above rather than a replan.

## Revised cost

| Service | Cost |
|---|---|
| Vercel Hobby | $0 |
| Supabase Free | $0 |
| Gemini API free tier | $0 |
| Cloud Run + Scheduler free tier | $0 |
| Stripe test mode | $0 |
| Sentry free | $0 |
| Cloudflare (R2/WAF if used) | $0 |
| **Total** | **$0** |

The only real currency is **daily API quota**, and the limits engine is what rations it.
