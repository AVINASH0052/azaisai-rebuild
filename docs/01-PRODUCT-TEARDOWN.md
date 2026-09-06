# 01 — Product Teardown: azaisai.com

Everything below was observed directly on 2026-09-06 by browsing the live site and
reading its shipped JavaScript bundles. Raw artefacts in [`research/`](research/).

> **Access limitation, stated up front.** I explored every publicly reachable surface
> end to end. I did **not** create an account: signup is email-OTP behind Cloudflare
> Turnstile, and the free-credit grant is gated on **phone-number verification**
> (one per number). Creating accounts and entering credentials on someone's behalf is
> outside what I'll do unattended. The authenticated surfaces below
> (`/history`, `/credits`, `/profile`, `/upgrade/checkout`, `/admin/*`, `/reposter`)
> are reconstructed from the shipped client bundles — route table, API calls, state
> shapes, and product copy — which is high-confidence for *structure* and *contracts*
> but not for pixel-level layout. See [Open questions](#open-questions) for the short
> list of things a 3-minute signed-in pass would settle. **The rebuild does not
> depend on any of them.**

---

## 1. What the product is

A credit-metered aggregator for third-party generative video and image models.
The pitch: "Sora, Veo, Runway in One Platform" — one subscription instead of five.

**The core loop, in full:**

```
sign in (email code) → verify phone → 8 free credits
   → pick mode (video | image)
   → pick model (12 options, each priced per second / per image)
   → write prompt  [optional: Enhance / Variation via LLM]
   → set params (aspect · duration · resolution · audio · style)
   → see estimated credit cost update live
   → Generate  → credits deducted → job queued
   → progress bar 0→95% (client-side easing, not real progress)
   → poll GET /api/generate/video/:id until status=ready
   → preview → download MP4/PNG  (watermarked on free tier)
   → lands in /history → can "rerun" with prefilled params
```

## 2. Stack, from the wire

| Layer | Evidence | Conclusion |
|---|---|---|
| Framework | `x-powered-by: Next.js`, `/_next/static/chunks/*`, RSC `vary: rsc, next-router-state-tree` | **Next.js App Router** |
| Host | `server: Vercel`, `x-vercel-id: bom1::iad1` | **Vercel**, edge in Mumbai, origin in Washington |
| Backend | `https://yccvhuxfakohyqhubvwi.supabase.co` in bundle | **Supabase** — Postgres + Auth + (likely) Storage |
| Auth | `/auth/login` → email → "Send code"; `/auth/check-email` route | **Supabase email OTP**, passwordless |
| Bot defence | Cloudflare Turnstile widget on auth forms | Turnstile |
| Media CDN | `https://res.cloudinary.com` | **Cloudinary** for gallery/marketing assets |
| Product analytics | `/api/surveys/`, `/api/early_access_features/`, `/api/web_experiments/`, `/api/product_tours/` | **PostHog** (self-proxied) |
| Marketing analytics | `googletagmanager.com`, `analytics.tiktok.com`, `gaBeginCheckout`/`ttqInitiateCheckout` helpers | **GA4 + TikTok Pixel**, full ecommerce event taxonomy |
| Payments | `/upgrade/checkout?product=…&currency=…&market=…` — no provider SDK in client bundle | Server-side checkout session creation. Provider not determinable client-side. |
| i18n | `["en","fr","es","it","pl","pt"]`, `NEXT_LOCALE` cookie | 6 locales |
| Styling | Tailwind utility classes, `oklch()` colours, shadcn/ui idioms (`cn()`, `rounded-2xl border-border/60 bg-card/50`) | **Tailwind + shadcn/ui**, dark-only |

## 3. Complete route map

Lifted verbatim from the `APP_ROUTES` constant in the bundle:

```js
{
  home: "/",                       login: "/auth/login",
  signup: "/auth/signup",          checkEmail: "/auth/check-email",
  video: "/generate/video",        image: "/generate/image",
  history: "/history",             credits: "/credits",
  profile: "/profile",             referrals: "/profile/referrals",
  upgrade: "/upgrade",             checkout: "/upgrade/checkout",
  success: "/upgrade/success",
  faq: "/faq",                     about: "/about",  contact: "/contact",
  reposter: "/reposter",
  admin: "/admin",
  adminUsers: "/admin/users",              adminGenerations: "/admin/generations",
  adminRevenue: "/admin/revenue",          adminCosts: "/admin/costs",
  adminModels: "/admin/models",            adminAttribution: "/admin/attribution",
  adminReposters: "/admin/reposters",      adminReposterVideos: "/admin/reposter-videos",
  adminAssignReposters: "/admin/assign-reposters",
  adminInsights: "/admin/insights",
}
```

Plus `AUTH_RETURN_PARAM = "returnUrl"` and `DEFAULT_AUTH_REDIRECT = "/generate/video"`
— i.e. signing in drops you straight into the video studio, not a dashboard. Good call;
we keep it.

**What that route list tells us about the business.** There are eleven admin routes
and one studio. `/admin/costs` and `/admin/attribution` alongside `/admin/revenue`
say this is an operator watching provider COGS against paid acquisition, per channel.
The reposter cluster (`/reposter`, `/admin/reposters`, `/admin/reposter-videos`,
`/admin/assign-reposters`) is a UGC distribution program — creators are assigned
generated videos to repost. That is a growth machine bolted onto a fairly simple
product. Worth understanding; not worth rebuilding in 12 hours.

## 4. Complete API surface

Extracted from bundles across `/`, `/upgrade`, `/generate/video`:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/generate/video` | POST | Submit job → `{ id }` |
| `/api/generate/video/:id` | GET | Poll → `{ status, output_url, thumbnail_url, output_path, thumbnail_path }` |
| `/api/generations/:id` | GET | Fetch a past generation (used by `?rerun=` prefill) |
| `/api/enhance-prompt` | POST | LLM rewrites prompt into a richer one |
| `/api/variate-prompt` | POST | LLM produces a variation |
| `/api/upload/source-image` | POST | Image→video source upload |
| `/api/storage/sign` | POST | Signed upload/download URL |
| `/api/credits` | GET | Current balance |
| `/api/credits/deduct` | POST | Spend credits |
| `/api/credits/packs` | GET | One-time top-up packs (dynamic, market-priced) |
| `/api/subscription/status` | GET | Plan state |
| `/api/trial/send-otp` | POST | Phone OTP for free trial |
| `/api/trial/verify-otp` | POST | Verify → grant 8 credits |
| `/api/trial/status` | GET | Trial eligibility |
| `/api/auth/signout` | POST | Sign out |
| `/api/broadcast` | ? | Announcement/banner channel |

**Job status enum, from the polling code:** `ready` is terminal-success; a `404`
means "Generation job not found"; other states drive the progress UI. The full set is
almost certainly `queued | processing | ready | failed`.

### The progress bar is theatre

Straight from the bundle:

```js
e<70 ? .3 : e<85 ? .15 : .05          // decreasing increment
l = Math.min(Math.max(Math.min(r+o,95), s), 95)   // hard-capped at 95%
```

The bar advances on a 500ms `setInterval` with a decelerating step, asymptoting at
95%, and only snaps to 100% when the poll returns `ready`. There is no real progress
signal from the provider. This is a defensible hack — but it's also the single most
visible place to beat the original, because a **real** pipeline state machine
(`queued → submitted → provider_processing → downloading → transcoding → ready`)
pushed over a realtime channel is both more honest and more reassuring to watch.
See [06](06-GENERATION-PIPELINE.md).

## 5. Model catalogue

### Video

| Model | Vendor | Bundle id | Price | Est. time | Badge |
|---|---|---|---|---|---|
| Sora Standard | OpenAI | `sora-2` | 1.0 cr/s | ~2m | POPULAR |
| Sora Pro | OpenAI | `sora-2-pro` | 2.0 cr/s | ~3m | PREMIUM |
| Veo 2 | Google | `veo-2` | 3.0 cr/s | ~45s | — |
| Veo 3 Fast | Google | `veo-3-fast` | 1.5 cr/s | ~35s | FAST |
| Veo 3 | Google | `veo-3-standard` | 3.0 cr/s | ~1m | NEW |
| Gen-4 Turbo | Runway | `runway-gen4-turbo` | 1.0 cr/s | ~2m | POPULAR |
| Gen-4.5 | Runway | — | 1.2 cr/s | ~2m | PREMIUM |
| Gen-3 Alpha Turbo | Runway | — | 1.0 cr/s | ~1m | FAST |

### Image

| Model | Vendor | Price | Est. time | Badge |
|---|---|---|---|---|
| GPT Image | OpenAI | 2 cr | ~10s | PREMIUM |
| Nano Banana 2 | Google | 1 cr | ~8s | NEW |
| Nano Banana 2 4K | Google | 2 cr | ~15s | 4K |
| Gen-4 Image | Runway | 1 cr | ~20s | NEW |

**Per-model capability flags observed in the UI:** an audio icon (🔊/🔇) distinguishes
models with native audio (Veo 3, Sora) from silent ones; some video models show
`SWITCH TO IMAGE MODE` when the Image→Video tab is active, i.e. they don't support
image conditioning. Aspect variants are baked into ids (`sora-landscape`,
`sora-portrait`, `veo-landscape`, `veo-portrait`) — the provider takes orientation
as part of the model selector, not as a free parameter. That's a real modelling
detail our adapter layer has to absorb.

**Studio parameters:**
- Video: mode `Text | Image`, aspect `16:9 | 9:16`, duration `4s | 6s | 8s`,
  resolution `720p | 1080p HD`, audio toggle.
- Image: style `None | Cinematic | Anime | Photo | Illustration | Abstract`,
  aspect `16:9 | 1:1 | 9:16 | 4:3 | 3:4`.
- Cost formula (video): `ceil(credits_per_second × duration_seconds)`.
  Sora Standard 8s → 8 credits. Veo 3 8s → 24. Matches the FAQ's stated
  "8–24 credits for a typical 8-second video."

## 6. Pricing and money

Three monthly plans, from the `PRODUCTS` constant. Prices are **per-market, not
converted** — each currency has a hand-set price point:

| Plan | Credits/mo | USD | EUR | GBP | CAD | AUD | PLN | SEK | NOK | DKK |
|---|---|---|---|---|---|---|---|---|---|---|
| Starter / Premium | 60 | $16.90 | €14.90 | £12.90 | C$22.90 | A$25.90 | 63.90 zł | 164.90 kr | 172.90 kr | 112.90 kr |
| **Pro** (popular) | 180 | $32.90 | €29.90 | £25.90 | C$44.90 | A$50.90 | 127.90 zł | 329.90 kr | 344.90 kr | 224.90 kr |
| Business | 420 | $65.90 | €59.90 | £50.90 | C$89.90 | A$101.90 | 254.90 zł | 659.90 kr | 689.90 kr | 449.90 kr |

`CURRENCY_SYMBOLS` also lists **BRL** and **INR**, and prices are stored
`priceInCents` — so the money layer is integer-cents, multi-currency, market-aware.
That is the right shape and we copy it.

Unit economics visible in the pricing ladder: $0.282/credit → $0.183 → $0.157.
A 30% volume discount at the top. Plus one-time credit packs fetched live from
`/api/credits/packs` (server-driven, so they can run promos without a deploy).

**Product copy that encodes real policy** (from the FAQ — these are requirements,
not marketing):
- Failed generations **do not consume credits**. → the refund path is a first-class
  requirement, not an edge case.
- Subscription credits **reset monthly, no rollover**; purchased packs live 12 months.
  → two credit buckets with different expiry, spent in the right order.
- Free tier outputs are **watermarked**, personal-use only; "your original clean files
  are always stored and revealed on upgrade." → they store clean + watermarked
  variants and gate delivery on plan.
- Free trial: **8 credits, phone-verified, one per phone number**, limited to
  Sora 2 (video) and Nano Banana 2 (image).

## 7. UX read — what's good and what isn't

**Genuinely good, keep it:**
- Dark, near-black (`oklch(0.05 0.01 255)`) canvas with a single blue accent. The
  output is the only colourful thing on screen. Correct instinct for a media tool.
- Left rail = controls, right = infinite canvas. Standard studio layout, no surprises.
- Live cost estimate pinned directly above the Generate button. You always know the
  price before you pay.
- Model cards carry price, ETA, badge, and audio capability inline — no drilling.
- `?rerun=<id>` prefill from history. Cheap, high-leverage.
- Signing in lands you in the studio, not a dashboard.
- FAQ answers the actual anxious questions (what happens when it fails, do credits
  expire, can I cancel).

**Weak, and where we win:**
1. **Fake progress.** Capped at 95%, decelerating, no relationship to reality. The
   most-watched surface in the product is lying.
2. **One job at a time.** The UI is built around a single in-flight generation. Video
   takes 30s–3min. A creator wants to fire four prompts and compare — the whole point
   of a multi-model aggregator is comparison, and the UI can't do it.
3. **Polling.** `setInterval` + HTTP GET per second, per client. Realtime over a
   websocket is less code, less load, and instant.
4. **Marketing page bloat.** The homepage ships ~200KB of HTML with a 40-item image
   marquee repeated 4× in the DOM. It's a landing page pretending to be an app.
5. **Phone verification for 8 free credits.** Rational anti-abuse, brutal activation
   funnel. Every prospect must hand over a phone number before seeing a single output.
6. **Nothing is shareable.** No public permalink for a generation. For a product whose
   growth depends on people posting their outputs, that's a missed loop — and it's
   presumably *why* the reposter program exists at all.
7. **No prompt scaffolding.** "Enhance" and "Variation" buttons exist, but there is no
   library, no history-derived suggestions, no starting points. A blank textarea is
   the hardest UI in generative AI.
8. **No teams.** Business tier at $65.90/mo is still a single seat with more credits.

## 8. Open questions

Would be settled by a short signed-in pass; **none block the rebuild.**

1. `/history` layout — grid or list? filters by model/type/date? bulk actions?
2. `/credits` — does it show a ledger (transaction history) or just a balance?
3. `/profile/referrals` — reward mechanics: credits per referral? both sides?
4. `/upgrade/checkout` — which payment provider renders. Affects nothing; we choose
   our own (Stripe, [ADR-007](12-DECISIONS-RISKS.md)).
5. Watermark rendering — burned in server-side, or overlaid at delivery?
6. `/api/broadcast` — in-app announcement banner, or something else?
7. Exact failure UX when a provider rejects a prompt on content policy.

**Ask for the reviewer:** if a demo account can be provided, item 1–3 would sharpen
the history and credits screens. Everything else in the plan stands regardless.
