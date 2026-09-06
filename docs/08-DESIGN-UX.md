# 08 — Design System & UX

## Position

The original's visual instinct is right and we keep it: near-black canvas, one accent,
generated output is the only saturated thing on screen. A media tool's job is to
disappear behind the media. Where we diverge is **information honesty** and
**parallelism** — the two places the original's UX actually fails
([01](01-PRODUCT-TEARDOWN.md) §7).

Three principles, applied to every screen:

1. **Never invent a number.** No fake progress, no fake ETA. If we don't know, we say
   what phase we're in.
2. **Price before commitment.** The cost of the next click is always visible before
   the click.
3. **The wait is the product.** Video takes 30–180 seconds. The waiting state is the
   most-looked-at surface in the app and gets designed first, not last.

## Tokens

Dark-first, `oklch()` throughout (as the original does), exposed as CSS custom
properties so a light theme is a token swap, not a refactor.

```css
:root {
  --bg:            oklch(0.05 0.010 255);   /* matched to the original's canvas */
  --bg-elevated:   oklch(0.09 0.012 255);
  --bg-inset:      oklch(0.07 0.010 255);
  --border:        oklch(0.22 0.015 255);
  --border-strong: oklch(0.32 0.020 255);
  --fg:            oklch(0.97 0.005 255);
  --fg-muted:      oklch(0.68 0.012 255);
  --fg-subtle:     oklch(0.50 0.012 255);
  --accent:        oklch(0.62 0.190 258);   /* the blue */
  --accent-fg:     oklch(0.99 0 0);
  --success:       oklch(0.70 0.150 155);
  --warning:       oklch(0.78 0.150 75);
  --danger:        oklch(0.62 0.200 25);

  --radius: 0.75rem;  /* rounded-xl base, 2xl on cards — matches original */
}
```

Type: Inter (UI) + JetBrains Mono (credits, ids, timings). Scale 12/14/16/20/24/32/48,
1.5 body leading, `-0.02em` tracking on display sizes.
Space: 4px base, 4/8/12/16/24/32/48/64.
Motion: 150ms `ease-out` for state, 250ms `cubic-bezier(0.32,0.72,0,1)` for entrances.
Everything respects `prefers-reduced-motion` — including the generating shimmer, which
becomes a static stage label.

## Component inventory

Built on shadcn/ui + Radix. Custom components that carry the product:

| Component | Notes |
|---|---|
| `ModelCard` | icon, label, badge, `1.5 cr/s · ~35s`, audio glyph. Selected = accent ring. Disabled with a reason tooltip when the current mode/params are unsupported. |
| `ModelPicker` | grid of cards, grouped by vendor, with a compare-mode multi-select. |
| `PromptComposer` | autosize textarea, char count, Enhance/Variate, preset chips, ⌘↵ to generate, ⌘K for the preset palette. |
| `ParamGroup` | segmented controls driven entirely by the selected model's capability set — unsupported options don't render, they don't render-disabled. |
| `CostBar` | sticky above Generate. `Cost 12 credits · balance 43 → 31`. Turns amber when balance would drop below one more generation, red + "Top up" at insufficient. |
| `GenerationCard` | the workhorse. One component, five states: queued / working / ready / failed / cancelled. |
| `ProgressIndicator` | three renderings for the three `Progress` kinds ([06](06-GENERATION-PIPELINE.md)). |
| `JobTray` | bottom-docked, collapsible, N concurrent jobs with live status. |
| `ResultViewer` | video player w/ scrub + loop + mute, or image with zoom. Download, Share, Rerun, Delete. |
| `CompareView` | 2–4 results in a synced grid; one scrubber drives all videos. |
| `LedgerRow` | signed amount, reason, linked generation thumbnail, running balance. |
| `EmptyState` | every list has a real one with a next action. Never a blank panel. |

## Screens

### Landing (`/`)

Lean. The original ships ~200KB of HTML with a 40-item marquee repeated four times.
Ours: hero + **live gallery pulled from real public generations** (seeded, then real
as users share) + three-step explainer + pricing + CTA. The gallery being real output
from the actual system, not stock, is the whole argument.

Above the fold: what it is, one video playing, one button. LCP budget 1.8s on 4G, so
the hero video is a poster image with `preload="none"` and plays on intersection.

### Auth (`/auth/login`, `/auth/signup`)

Two steps: email → 6-digit code. Paste-a-whole-code handled (one input, `otp`
autocomplete, splits on paste). Turnstile. Resend with a visible cooldown. Errors are
specific: "That code expired — we sent a new one" beats "Invalid code."
`returnUrl` preserved, and signing in lands in the studio — the original's choice, and
it's right.

### Studio (`/studio/video`, `/studio/image`) — the product

```
┌────────────────────────────────────────────────────────────────────────┐
│  ▣ AzaisAI    Video · Image        [prompt palette ⌘K]   43 cr  ◐ Pro  │
├──────────────────────┬─────────────────────────────────────────────────┤
│  MODE  Text  Image   │                                                 │
│                      │                                                 │
│  MODEL               │              ┌───────────────────┐              │
│  ┌────┐┌────┐        │              │                   │              │
│  │Sora││Veo3│  ⋯     │              │   result canvas   │              │
│  └────┘└────┘        │              │                   │              │
│  [+ compare models]  │              └───────────────────┘              │
│                      │                                                 │
│  PROMPT              │        ↓ or, while generating ↓                 │
│  ┌────────────────┐  │                                                 │
│  │                │  │   ●━━━━━━━━━━━○────────  Rendering frames       │
│  └────────────────┘  │   Veo 3 Fast · 8s · ~22s left                   │
│  ✨Enhance  ⟲Variate │                                                 │
│                      │                                                 │
│  SETTINGS            │                                                 │
│  Aspect  16:9  9:16  │                                                 │
│  Length  4  6  8     │                                                 │
│  Res     720p  1080p │                                                 │
│  Audio   ●           │                                                 │
├──────────────────────┤                                                 │
│ Cost 12 cr  43 → 31  │                                                 │
│ [   Generate  ⌘↵  ]  │                                                 │
└──────────────────────┴─────────────────────────────────────────────────┘
│ JOB TRAY  ▸ 3 running   [Veo3 ▓▓▓░ 62%] [Sora ▓░░░ queued] [GPT ✓]     │
└────────────────────────────────────────────────────────────────────────┘
```

Divergences from the original, each deliberate:

1. **Job tray.** The original's studio holds one generation. Ours holds N, and the
   canvas shows whichever you select. This is what makes a *multi-model* platform
   actually multi-model.
2. **Compare mode.** Select 2–4 models, one prompt, one Generate. Results land in a
   synced grid. It's the honest answer to "which model should I use?" and it is the
   single best 30 seconds of the walkthrough video.
3. **Real progress.** Stage label + real ETA from that model's rolling p50, or an
   indeterminate shimmer. Never a fabricated percentage.
4. **Capability-driven params.** Selecting Veo 3 Fast removes 1080p rather than
   showing it and failing at submit. The original shows all options for all models.
5. **⌘K prompt palette.** Presets, recent prompts, and history search in one dialog.
6. **Keyboard-complete.** ⌘↵ generate, ⌘K palette, 1–9 select model, ⌥↑↓ cycle job
   tray, `d` download focused result. A tool you use fifty times a day should not
   require a mouse.

### History (`/history`)

Masonry grid, hover-to-play video, filter rail (kind, model, status, date, batch),
full-text prompt search, multi-select for bulk download/delete. Each card: rerun,
share, download, delete. Batch results group under one card with a count.

### Credits (`/credits`)

Balance, expiry warnings, plan state, and the full ledger. Laid out in
[07](07-CREDITS-BILLING.md).

### Share (`/g/[shareId]`)

Public, no auth. The output large, the prompt, the model, a "Make your own" CTA.
Dynamic `opengraph-image` renders the thumbnail + prompt so a Slack/X unfurl is real.
This is the growth loop the original is missing, and it costs one route.

### Admin (`/admin`)

One page, read-only: generations today, success rate, p50 duration by model, credits
sold vs `provider_cost_cents` (margin), spend against the daily cap. Replaces eleven
routes with the numbers those routes exist to produce.

## States, for every surface

The four states are designed, not discovered:

- **Empty** — illustration-free, one sentence, one action. History empty → "Nothing
  yet. Generate your first video →".
- **Loading** — skeletons that match the final layout's geometry, so nothing shifts.
  CLS budget 0.
- **Error** — specific to the error code ([05](05-API-CONTRACT.md)), with the matching
  recovery action inline: 402 → Top up, 503 → try another model, 422 → rewrite prompt.
  `request_id` shown in mono, copyable.
- **Offline** — realtime disconnect shows a "Reconnecting" chip and silently falls back
  to polling, so a flaky connection degrades instead of freezing.

## Responsive

Mobile is not an afterthought — a meaningful share of this audience is on a phone.
- `< 768px`: controls become a bottom sheet, canvas is full-bleed, job tray is a
  horizontal scroller. Generate is a fixed bottom bar with the cost inline.
- `768–1279px`: 320px rail.
- `≥ 1280px`: 420px rail (matches the original's `lg:w-[420px]`).

## Accessibility

Target: WCAG 2.2 AA, verified with axe in CI on five key routes.
- All text ≥ 4.5:1 against its background. The muted greys are chosen to pass, which
  is why `--fg-subtle` sits at 0.50 lightness and not lower.
- Full keyboard reachability; visible focus rings (`--accent`, 2px, 2px offset).
- Model cards are a real radiogroup; params are real radiogroups. Not divs with
  onClick.
- Job status changes announce via `aria-live="polite"` — a screen-reader user is told
  their video is ready without watching a spinner they can't see.
- Videos: `controls`, no autoplay with sound, captions n/a but `<track>` slot present.
- Reduced motion honoured everywhere including the generating shimmer.

## Performance

Route-level code splitting; the studio's heavy bits (video player, compare grid)
`dynamic()` imported. `next/image` with AVIF/WebP for all thumbnails. Realtime replaces
per-second polling, which removes N requests/sec/client. Budget: studio JS < 180KB
gzip, landing LCP < 1.8s.
