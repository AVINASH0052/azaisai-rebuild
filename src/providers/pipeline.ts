export type PipelineState = {
  segment: number;
  segments: number;
  videoUris: string[];
};

export type PipelineNext =
  | { action: "chain"; nextIndex: number; seedFromUri: string; videoUris: string[] }
  | { action: "stitch"; videoUris: string[] }
  | { action: "ready"; videoUris: string[] };

export function createLiveJobId(
  kind: "video" | "image",
  extra?: { durationSec?: number; segments?: number },
) {
  const rand = Math.random().toString(36).slice(2, 6);
  const duration = extra?.durationSec ?? (kind === "video" ? 8 : 0);
  const segments = extra?.segments ?? 1;
  return `g_${Date.now()}_${kind}_${rand}_${duration}_${segments}`;
}

export function isLiveJobId(id: string) {
  return id.startsWith("g_");
}

export function clipFileUrl(id: string, op: string) {
  return `/api/generations/${encodeURIComponent(id)}/file?op=${encodeURIComponent(op)}`;
}

export function afterSegmentReady(
  state: PipelineState,
  uri: string,
  hasWorker: boolean,
): PipelineNext {
  const videoUris = [...state.videoUris, uri];
  if (videoUris.length < state.segments) {
    return { action: "chain", nextIndex: videoUris.length, seedFromUri: uri, videoUris };
  }
  if (hasWorker) return { action: "stitch", videoUris };
  return { action: "ready", videoUris };
}

export function pipelineProgress(segment: number, segments: number, stitching = false) {
  if (stitching) return { progress: 95, stage: "Stitched" };
  const pct = Math.min(90, Math.round(((segment + 0.4) / segments) * 90));
  const stage = segments > 1 ? `Segment ${segment + 1} of ${segments}` : "Veo rendering";
  return { progress: pct, stage };
}
