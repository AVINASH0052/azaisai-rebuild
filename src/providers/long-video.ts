export const MIN_VIDEO_SEC = 4;
export const MAX_VIDEO_SEC = 20;
export const MAX_SEGMENTS = 5;
export const DURATION_PRESETS = [6, 8, 10, 12, 16, 20] as const;

export function clampDuration(value: number) {
  if (!Number.isFinite(value)) return 8;
  return Math.min(MAX_VIDEO_SEC, Math.max(MIN_VIDEO_SEC, Math.round(value)));
}

export function isVideoDuration(value: number) {
  return Number.isInteger(value) && value >= MIN_VIDEO_SEC && value <= MAX_VIDEO_SEC;
}

export function shortestAtoms(target: number): number[] | null {
  if (target < 4) return null;
  for (let eights = Math.floor(target / 8); eights >= 0; eights--) {
    const after8 = target - eights * 8;
    for (let sixes = Math.floor(after8 / 6); sixes >= 0; sixes--) {
      const rem = after8 - sixes * 6;
      if (rem % 4 !== 0) continue;
      return [...Array(eights).fill(8), ...Array(sixes).fill(6), ...Array(rem / 4).fill(4)];
    }
  }
  return null;
}

export function clipPlan(durationSec: number) {
  const want = clampDuration(durationSec);
  const atoms = shortestAtoms(want) ?? shortestAtoms(want + 1) ?? [8];
  let start = 0;
  return atoms.map((veoSec, index) => {
    const contentSec = Math.min(veoSec, want - start);
    const window = {
      index,
      startSec: start,
      endSec: start + contentSec,
      contentSec,
      veoSec,
    };
    start += contentSec;
    return window;
  });
}

export function segmentCount(durationSec: number) {
  return clipPlan(durationSec).length;
}

export function generatedSeconds(durationSec: number) {
  return clipPlan(durationSec).reduce((sum, w) => sum + w.veoSec, 0);
}

export function veoSecForBeat(durationSec: number, index: number) {
  return clipPlan(durationSec)[index]?.veoSec ?? 8;
}

export function beatWindows(durationSec: number) {
  return clipPlan(durationSec);
}

export type Beat = {
  index: number;
  startSec: number;
  endSec: number;
  contentSec: number;
  veoSec: number;
  prompt: string;
};

export function fallbackBeats(prompt: string, durationSec: number): Beat[] {
  return beatWindows(durationSec).map((w) => ({
    ...w,
    prompt:
      w.index === 0
        ? prompt
        : w.contentSec < w.veoSec
          ? `Continues from the last frame. ${prompt} Resolves by ${w.contentSec}s.`
          : `Continues from the last frame. ${prompt}`,
  }));
}

export function veoAtom(sec: number, veo2 = false) {
  const n = sec <= 4 ? 4 : sec <= 6 ? 6 : 8;
  if (veo2 && n === 4) return 5;
  return n;
}
