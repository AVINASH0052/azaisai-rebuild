export const SEGMENT_SEC = 8;
export const MIN_VIDEO_SEC = 4;
export const MAX_VIDEO_SEC = 20;
export const MAX_SEGMENTS = Math.ceil(MAX_VIDEO_SEC / SEGMENT_SEC);
export const DURATION_PRESETS = [8, 12, 16, 20] as const;

export function clampDuration(value: number) {
  if (!Number.isFinite(value)) return 8;
  return Math.min(MAX_VIDEO_SEC, Math.max(MIN_VIDEO_SEC, Math.round(value)));
}

export function isVideoDuration(value: number) {
  return Number.isInteger(value) && value >= MIN_VIDEO_SEC && value <= MAX_VIDEO_SEC;
}

export function segmentCount(durationSec: number) {
  return Math.min(
    MAX_SEGMENTS,
    Math.max(1, Math.ceil(clampDuration(durationSec) / SEGMENT_SEC)),
  );
}

export function generatedSeconds(durationSec: number) {
  return segmentCount(durationSec) * SEGMENT_SEC;
}

export function beatWindows(durationSec: number) {
  const duration = clampDuration(durationSec);
  const n = segmentCount(duration);
  return Array.from({ length: n }, (_, i) => {
    const start = i * SEGMENT_SEC;
    const end = i === n - 1 ? duration : start + SEGMENT_SEC;
    return { index: i, startSec: start, endSec: end, contentSec: end - start };
  });
}

export type Beat = {
  index: number;
  startSec: number;
  endSec: number;
  contentSec: number;
  prompt: string;
};

export function fallbackBeats(prompt: string, durationSec: number): Beat[] {
  return beatWindows(durationSec).map((w) => ({
    ...w,
    prompt:
      w.index === 0
        ? prompt
        : w.contentSec < SEGMENT_SEC
          ? `Continues from the last frame. ${prompt} Resolves by ${w.contentSec}s.`
          : `Continues from the last frame. ${prompt}`,
  }));
}
