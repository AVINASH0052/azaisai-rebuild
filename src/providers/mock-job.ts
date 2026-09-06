import type { Kind } from "./registry";
import { segmentCount } from "./long-video";

export function createJobId(
  kind: Kind,
  extra?: { durationSec?: number; segments?: number },
) {
  const rand = Math.random().toString(36).slice(2, 6);
  const duration = extra?.durationSec ?? (kind === "video" ? 8 : 0);
  const segments = extra?.segments ?? (kind === "video" ? segmentCount(duration) : 1);
  return `m_${Date.now()}_${kind}_${rand}_${duration}_${segments}`;
}

export function parseJobId(id: string) {
  const parts = id.split("_");
  if (parts[0] !== "m" || parts.length < 3) return null;
  const createdAt = Number(parts[1]);
  const kind = parts[2];
  if (!Number.isFinite(createdAt) || (kind !== "video" && kind !== "image")) {
    return null;
  }
  const durationSec = Number(parts[4] ?? (kind === "video" ? 8 : 0));
  const segments = Number(parts[5] ?? 1);
  return {
    createdAt,
    kind: kind as Kind,
    durationSec: Number.isFinite(durationSec) ? durationSec : 8,
    segments: Number.isFinite(segments) && segments > 0 ? segments : 1,
  };
}

export function mockDurationMs(kind: Kind, segments = 1) {
  if (kind === "image") return 1400;
  return 400 + 1100 * segments;
}

export function mockStatus(createdAt: number, kind: Kind, segments = 1) {
  const elapsed = Date.now() - createdAt;
  const total = mockDurationMs(kind, segments);
  if (elapsed < 400) {
    return { status: "queued" as const, progress: 0, stage: "Queued", segment: 0, segments };
  }
  if (elapsed < total) {
    const working = elapsed - 400;
    const per = (total - 400) / segments;
    const index = Math.min(segments, Math.floor(working / per) + 1);
    const pct = Math.min(99, Math.round((working / (total - 400)) * 100));
    const stage =
      kind === "video" && segments > 1
        ? `Segment ${index} of ${segments}`
        : kind === "video"
          ? "Rendering frames"
          : "Painting";
    return { status: "processing" as const, progress: pct, stage, segment: index, segments };
  }
  return {
    status: "ready" as const,
    progress: 100,
    stage: segments > 1 ? "Stitched" : "Ready",
    segment: segments,
    segments,
  };
}
