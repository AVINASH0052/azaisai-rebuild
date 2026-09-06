import type { Kind } from "./registry";

export function createJobId(kind: Kind) {
  const rand = Math.random().toString(36).slice(2, 6);
  return `m_${Date.now()}_${kind}_${rand}`;
}

export function parseJobId(id: string) {
  const parts = id.split("_");
  if (parts[0] !== "m" || parts.length < 3) return null;
  const createdAt = Number(parts[1]);
  const kind = parts[2];
  if (!Number.isFinite(createdAt) || (kind !== "video" && kind !== "image")) {
    return null;
  }
  return { createdAt, kind: kind as Kind };
}

/** Demo waits seconds, not the model's real ETA. */
export function mockDurationMs(kind: Kind) {
  return kind === "video" ? 2800 : 1400;
}

export function mockStatus(createdAt: number, kind: Kind) {
  const elapsed = Date.now() - createdAt;
  const total = mockDurationMs(kind);
  if (elapsed < 400) {
    return { status: "queued" as const, progress: 0, stage: "Queued" };
  }
  if (elapsed < total) {
    const pct = Math.min(99, Math.round(((elapsed - 400) / (total - 400)) * 100));
    return {
      status: "processing" as const,
      progress: pct,
      stage: kind === "video" ? "Rendering frames" : "Painting",
    };
  }
  return { status: "ready" as const, progress: 100, stage: "Ready" };
}
