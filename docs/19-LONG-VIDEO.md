# 19 — Long-Form Video: 20s from an 8s model

## The problem

Veo generates **8-second clips**. Users want 20s. Naively that's three clips, and three
clips generated independently from the same prompt are three *unrelated* shots — the
character changes face, the lighting jumps, the location shifts. Concatenating them
produces something visibly broken, which is worse than not offering the feature.

Getting this right is the single most interesting piece of engineering in the build, and
it's a real differentiator: the original tops out at 8s.

## Rejected: naive concatenation

Generate N clips from the same prompt, `ffmpeg concat`, ship it. Costs an hour, looks
amateurish, and every join is a hard discontinuity in subject and style. Not worth
building.

## The approach: plan → chain → stitch

Three ideas, each doing real work:

**1. Scene decomposition (Gemini Flash).** Split the user's prompt into N consecutive
8-second beats that form one continuous scene, each written as a *continuation* of the
last rather than a standalone shot.

**2. Last-frame chaining (the key mechanism).** Generate beat 1 text→video. Extract its
**final frame**. Generate beat 2 as **image→video**, seeded with that frame plus beat
2's prompt. Repeat. Every clip starts exactly where the previous one ended, so subject,
lighting, and composition carry across the join.

**3. Stitch and trim.** Concatenate, handle the audio seams, trim to the requested
duration.

```
"A neon-lit city drone shot"  ·  20s
        │
        ▼
┌─ Gemini Flash: decompose ────────────────────────────────┐
│ beat 1 (0-8s)   drone rises between neon towers, rain    │
│ beat 2 (8-16s)  continues forward, banks left past a sign│
│ beat 3 (16-20s) descends toward the wet street, settles  │
└──────────────────────────────────────────────────────────┘
        │  ← user can edit every beat before spending anything
        ▼
  ┌───────────┐  last frame  ┌───────────┐  last frame  ┌───────────┐
  │  Veo t2v  │─────────────►│  Veo i2v  │─────────────►│  Veo i2v  │
  │  beat 1   │              │  beat 2   │              │  beat 3   │
  └─────┬─────┘              └─────┬─────┘              └─────┬─────┘
        └──────────────┬───────────┴──────────────────────────┘
                       ▼
              ffmpeg concat + audio seam + trim to 20s
                       ▼
                 one 20s MP4
```

**Prerequisite:** Veo image→video seeding must work on the free tier. That's the second
item on the [18](18-FREE-TIER-STACK.md) verification checklist, checked at H0.25,
because **if it doesn't work this feature reduces to hard cuts between independent
shots** — which we'd then ship as "multi-shot" rather than "continuous," honestly
labelled, or not ship at all.

## Why the joins actually look right

Clip 2's first frame is generated *from* clip 1's last frame. The two are near-identical
by construction, so a **hard cut is nearly invisible** — no crossfade needed, which
matters because crossfading forces a full re-encode and a hard cut allows
`ffmpeg -c copy` (stream copy, ~1 second, zero quality loss).

Crossfade stays available as a per-join option (`xfade`, 0.4s) for cases where the
chaining drifts, at the cost of re-encoding. Default is the hard cut.

## Segment mathematics

Duration options are driven by segment count, since the model's atom is 8s:

| Requested | Segments | Generated | Trim |
|---|---|---|---|
| 8s | 1 | 8s | — |
| 16s | 2 | 16s | — |
| **20s** | **3** | **24s** | **−4s** |
| 24s | 3 | 24s | — |
| 32s | 4 | 32s | — |

`segments = ceil(duration / 8)`, capped at **4 (32s)** — a quota decision, not a
technical one ([18](18-FREE-TIER-STACK.md)).

**Trimming:** the tail of the final segment is cut. To stop that from lopping off an
ending mid-motion, the scene planner is told the final beat has only 4 seconds of
content and must resolve by then. Cheap prompt-level fix for what would otherwise be an
obviously truncated last shot.

## ffmpeg mechanics

Runs on Cloud Run, where there's a real filesystem, a real ffmpeg binary, and a 60-minute
timeout instead of Vercel's 60 seconds.

```bash
# 1. last frame of a segment  →  seed for the next
ffmpeg -sseof -0.5 -i seg1.mp4 -update 1 -frames:v 1 -q:v 2 seed2.jpg

# 2. concat — stream copy, no re-encode (requires identical codec params)
printf "file 'seg1.mp4'\nfile 'seg2.mp4'\nfile 'seg3.mp4'\n" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4

# 3. trim to the exact requested duration
ffmpeg -i joined.mp4 -t 20 -c copy final.mp4

# 4. thumbnail
ffmpeg -ss 1 -i final.mp4 -frames:v 1 -vf scale=640:-1 -f webp thumb.webp
```

Stream copy works only if every segment shares codec, resolution, framerate and pixel
format. Veo output should be uniform — **verified at H0.25** — and the worker falls back
to the concat *filter* with re-encode if `ffprobe` finds a mismatch. Slower, still
correct.

### Audio seams

Veo generates native audio, and concatenating three independent audio tracks produces an
audible click or an abrupt ambience change at each join. Handling, in order of
preference:

1. **100ms audio fade in/out at each join** — imperceptible, kills the click, needs only
   an audio re-encode (video still stream-copied).
2. `acrossfade` 0.3s — smoother, costs a full audio re-encode.
3. **Continuous bed**: mute segment audio and lay one generated ambience track across
   the whole video. Cleanest result, loses Veo's per-shot sound design.

Default is (1). Option (3) is exposed as "unified soundtrack" for users who care more
about seamlessness than per-shot audio.

## Data model

Long videos need per-segment rows so retries are surgical and partial failures are
recoverable. Extends [04](04-DATA-MODEL.md).

### `generation_segments`
| col | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `generation_id` | uuid fk | the parent |
| `index` | smallint | 0-based order |
| `prompt` | text | this beat's prompt, user-editable pre-generation |
| `status` | gen_status | same enum as the parent |
| `provider_job_id` | text null | Veo operation name |
| `seed_image_path` | text null | last frame of segment `index-1`; null for segment 0 |
| `output_path` | text null | |
| `last_frame_path` | text null | extracted, feeds the next segment |
| `error_code`, `attempt` | | per-segment retry |
| `duration_ms` | int | |

Parent `generations` gains: `segment_count`, `requested_duration_seconds`,
`stitch_status`, `storyboard jsonb` (the planner's output, kept for rerun).

**The parent is `ready` only when every segment is `ready` and the stitch succeeds.**

### Storage discipline

Segments and seed frames are **deleted once the stitch succeeds** — a 20s video would
otherwise occupy ~4× its final size in a 1GB budget
([18](18-FREE-TIER-STACK.md) §1). Only the stitched output and its thumbnail persist.
Segments are retained on *failure*, so a retry doesn't regenerate work that succeeded.

## Failure handling — the part that matters

Segment 2 of 3 failing is the common case, and it's where a naive implementation charges
for three clips and delivers nothing.

```
                 ┌──────────────────────────────────────────┐
segment fails ──►│ retryable (provider_error / timeout)?     │
                 │   → retry THAT segment only, ×3, backoff  │
                 │   → segments 1 and 3 are untouched        │
                 └──────────────┬───────────────────────────┘
                                │ still failing
                                ▼
                 ┌──────────────────────────────────────────┐
                 │ any leading segments succeeded?           │
                 │  yes → PARTIAL: stitch 1..k, deliver a    │
                 │        shorter video, refund the failed   │
                 │        segments' credits                  │
                 │  no  → FAILED: full refund                │
                 └──────────────────────────────────────────┘
```

**Partial delivery is a real outcome, not an error state.** If segments 1 and 2 land and
3 doesn't, the user gets a 16s video and is charged for 2 segments, with the ledger
showing a 1-segment refund. Getting 16 of 20 seconds beats getting nothing, and it
matches the FAQ promise that failed generations aren't charged.

Only *leading* segments can be delivered — segment 3 without segment 2 is not a video.
Chaining makes that constraint structural: segment 3 couldn't have been generated
without 2's last frame anyway.

## Credit accounting

**Charged per generated segment, not per delivered second**, because that's what the
quota actually costs us:

```
credits = segments × 8 × model.rate_per_second
```

A 20s video at 1 cr/s is **24 credits, not 20** — three 8s generations. This is stated
explicitly in the cost bar before the user commits:

```
Cost  24 credits          3 segments × 8s  ·  20s delivered
      balance 43 → 19
```

Hiding the discrepancy would be the sort of small dishonesty that costs trust the first
time someone does the arithmetic.

## UX: the storyboard — the actual differentiator

This is where a long-video feature stops being a checkbox. The user does not blind-fire
24 credits at a black box.

```
┌── Storyboard ──────────────────────── 20s · 3 segments · 24 credits ──┐
│                                                                        │
│  1 │ 0–8s   ┌──────────┐  Drone rises between neon towers, rain on    │
│    │        │  ✓ ready │  the lens, reflections in wet glass.    ✎    │
│    │        └──────────┘                                               │
│                                                                        │
│  2 │ 8–16s  ┌──────────┐  Camera continues forward, banks left past   │
│    │        │ ▓▓▓░ 61% │  a flickering sign.                      ✎    │
│    │        └──────────┘                                               │
│                                                                        │
│  3 │ 16–20s ┌──────────┐  Descends toward the street, settles on a    │
│    │        │  queued  │  puddle. Resolves by 4s.                 ✎    │
│    │        └──────────┘                                               │
│                                                                        │
│  ⓘ Each segment continues from the last frame of the one before it.   │
│                                        [ Regenerate ▾ ]  [ Generate ]  │
└────────────────────────────────────────────────────────────────────────┘
```

What this buys:

- **Edit before spending.** Gemini's decomposition is a draft. The user rewrites any
  beat before a single credit moves.
- **Progress that means something.** "Segment 2 of 3" is honest, granular, real progress —
  exactly the [ADR-009](12-DECISIONS-RISKS.md) principle, and here the percentage is
  genuinely computable rather than invented.
- **Regenerate one segment.** Don't like beat 2? Regenerate just it — 8 credits, not 24.
  Segments 3+ are then re-chained from the new last frame, and the UI says so before
  charging.
- **Partial failure is legible.** A failed segment is visibly one card, not a dead
  20-second job.

Regenerating a *middle* segment invalidates everything after it, since the chain breaks.
The UI states the consequence and the cost up front rather than silently re-billing.

## Delivery

Sits inside the existing pipeline — the state machine, ledger, refunds, and realtime all
already handle it; long video is a parent with children.

Added to **H4–H6** (pipeline), ~30 min:
- [ ] `generation_segments` table + parent columns
- [ ] Sequential segment orchestration in the worker, chained on `last_frame_path`
- [ ] Partial-failure and per-segment refund logic

Added to **H7.5–H8.5** (providers), ~45 min:
- [ ] Gemini Flash scene decomposition → `storyboard`
- [ ] Veo image→video seeding in the adapter
- [ ] ffmpeg: last-frame extraction, concat, audio seam, trim, thumbnail
- [ ] Cloud Run container with ffmpeg

Added to **H8.5–H9.5** (differentiators), ~30 min:
- [ ] Storyboard editor UI, per-segment status, single-segment regenerate

**~105 minutes total.** It replaces "compare mode" as the headline differentiator in the
walkthrough — a 20s continuous video from an 8s model is a more striking demonstration
than a side-by-side grid, and unlike compare mode it doesn't multiply quota consumption
on a free tier. Compare mode drops to Tier 2.

**Cut fallback:** if image→video seeding turns out not to work at H0.25, ship the
storyboard + independent-shot generation labelled honestly as "multi-shot," or cut the
feature entirely and say why in the walkthrough. What doesn't happen is shipping visibly
broken joins and calling it continuous.
