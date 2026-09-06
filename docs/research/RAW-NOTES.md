# Raw research notes — azaisai.com

Collected 2026-09-06. Method: browsed every public route, then fetched and grepped the
shipped Next.js client chunks for configuration constants. Saved HTML in this folder.

## Method

```bash
curl -s https://www.azaisai.com/ -o home.html
for c in $(grep -o '/_next/static/chunks/[a-zA-Z0-9_./-]*\.js' home.html | sort -u); do
  curl -s "https://www.azaisai.com$c"
done > allchunks.js          # ~1.4MB
# repeated for /upgrade and /generate/video
grep -oE '/api/[a-zA-Z0-9/_-]{2,40}' *.js | sort -u
grep -oE 'APP_ROUTES.{0,600}' upchunks.js
grep -oE 'PRODUCTS.{0,2000}' upchunks.js
```

## Verbatim extracts

### `APP_ROUTES`
```js
{home:"/",login:"/auth/login",signup:"/auth/signup",checkEmail:"/auth/check-email",
 video:"/generate/video",image:"/generate/image",generateVideo:"/generate/video",
 generateImage:"/generate/image",history:"/history",credits:"/credits",
 profile:"/profile",upgrade:"/upgrade",checkout:"/upgrade/checkout",
 success:"/upgrade/success",admin:"/admin",adminUsers:"/admin/users",
 adminGenerations:"/admin/generations",adminRevenue:"/admin/revenue",
 adminCosts:"/admin/costs",adminModels:"/admin/models",
 adminAttribution:"/admin/attribution",adminReposters:"/admin/reposters",
 adminReposterVideos:"/admin/reposter-videos",
 adminAssignReposters:"/admin/assign-reposters",adminInsights:"/admin/insights",
 referrals:"/profile/referrals",reposter:"/reposter",faq:"/faq",about:"/about",
 contact:"/contact"}
AUTH_RETURN_PARAM = "returnUrl"
DEFAULT_AUTH_REDIRECT = "/generate/video"
```

### `CURRENCY_SYMBOLS`
```js
{USD:"$",EUR:"€",GBP:"£",CAD:"C$",AUD:"A$",PLN:"zł",SEK:"kr",NOK:"kr",DKK:"kr",
 BRL:"R$",INR:"₹"}
DEFAULT_CURRENCY = "USD"
```

### `PRODUCTS` (abridged — full table in ../01-PRODUCT-TEARDOWN.md §6)
```js
[{id:"azaisai-premium-monthly", interval:"month", credits:60,
  prices:[{currency:"USD",priceInCents:1690},{currency:"EUR",priceInCents:1490},…]},
 {id:"azaisai-pro-monthly",     interval:"month", credits:180,
  prices:[{currency:"USD",priceInCents:3290},…]},
 {id:"azaisai-business-monthly",interval:"month", credits:420,
  prices:[{currency:"USD",priceInCents:6590},…]}]
```

### Checkout URL construction
```js
`${APP_ROUTES.checkout}?product=${e}&currency=${T}&market=${k}`
`${APP_ROUTES.credits}/checkout?pack=${s}&currency=${e}&market=${h}`
// unauthenticated → buildAuthRedirectUrl(APP_ROUTES.signup, t)
```

### Generation submit
```js
{prompt, variantId, aspectRatio:v, durationSeconds:w, audio:k, resolution:S,
 ...(mode==="image" && L ? {sourceImageUrl:L} : {}),
 ...(mode==="image" && E ? {sourceImagePath:E} : {})}
→ POST /api/generate/video → {id}
```

### Generation poll + the fake progress bar
```js
// polling
const s = async () => {
  const r = await fetch(`/api/generate/video/${e}`);
  if (!r.ok) { if (r.status===404) { …"Generation job not found." } }
  const n = await r.json();
  if (n.status === "ready") { …ed(n.output_url), eu(n.thumbnail_url),
                                ep(n.output_path), eg(n.thumbnail_path) }
}
// progress: 500ms interval, decelerating step, hard cap at 95%
o = e<70 ? .3 : e<85 ? .15 : .05
l = Math.min(Math.max(Math.min(r+o, 95), s), 95)
```

### Rerun prefill
```js
const e = U.get("rerun");
if (e) fetch(`/api/generations/${e}`).then(r=>r.json()).then(d => eG({
  prompt: d.prompt ?? "", variantId: d.variantId, aspectRatio: d.aspectRatio,
  durationSeconds: d.durationSeconds, resolution: d.resolution,
  audio: d.hasAudio, sourceImageUrl: d.sourceImageUrl, …}))
```

### Analytics helpers found
```
gaAddToCart, gaBeginCheckout, gaFreeTrial, gaLogin, gaSignUp,
gaSubscribePurchase, gaTopupPurchase
ttqAddToCart, ttqCompleteRegistration, ttqFreeTrial, ttqIdentify,
ttqInitiateCheckout, ttqLogin, ttqPage, ttqViewContent
```
GA4 ecommerce + TikTok Pixel, full funnel taxonomy.

### Model ids seen in bundle
```
sora-2, sora-2-pro, sora-landscape, sora-portrait,
veo-2, veo-3-fast, veo-3-standard, veo-landscape, veo-portrait,
runway-gen4-turbo, nano-banana-2
```
Orientation is encoded in the model id, not passed as a free parameter — the adapter
layer has to map `(model, aspect) → providerModel`.

### Infrastructure
```
server: Vercel                          x-vercel-id: bom1::iad1
x-powered-by: Next.js                   vary: rsc, next-router-state-tree
https://yccvhuxfakohyqhubvwi.supabase.co
https://res.cloudinary.com
set-cookie: NEXT_LOCALE=en
locales: ["en","fr","es","it","pl","pt"]
PostHog self-proxied: /api/{surveys,early_access_features,web_experiments,product_tours}
Cloudflare Turnstile on auth forms
apex azaisai.com → 307 → www.azaisai.com
```

### Observed page weights
- `/` — 201KB HTML (40-image marquee repeated 4× in the DOM), ~1.4MB JS chunks
- `/upgrade` — 94KB HTML, ~1.3MB JS
- `/generate/video` — 118KB HTML, ~1.5MB JS

## Screenshots

Captured during the browsing pass (in `screenshots/`, to be re-captured to disk with
`scripts/capture-screenshots.ts` during the build):

| File | Surface |
|---|---|
| `01-landing.png` | hero + "Sign in to Unlock / Free AI Credits" card |
| `02-upgrade.png` | three-plan pricing grid |
| `03-studio-video-top.png` | model picker, 8 video models with credit rates + ETAs |
| `04-studio-video-params.png` | prompt box, Enhance/Variation, aspect/duration/resolution, cost bar |
| `05-studio-image.png` | 4 image models, style chips, aspect options |
| `06-signup.png` | email → "Send code" |
| `07-login.png` | same + Cloudflare Turnstile widget |

## Not observed (no account created — see ../01 §8)

`/history`, `/credits`, `/profile`, `/profile/referrals`, `/upgrade/checkout`,
`/upgrade/success`, `/admin/*`, `/reposter`. Contracts for these were derived from the
route table and the API calls in the bundle; layouts were not.
