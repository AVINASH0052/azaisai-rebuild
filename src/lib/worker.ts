import { env } from "./env";

export function workerConfigured() {
  return Boolean(env.WORKER_URL && env.WORKER_SECRET);
}

async function workerFetch(path: string, init?: RequestInit) {
  if (!env.WORKER_URL || !env.WORKER_SECRET) {
    throw new Error("worker unconfigured");
  }
  return fetch(new URL(path, env.WORKER_URL), {
    ...init,
    headers: {
      Authorization: `Bearer ${env.WORKER_SECRET}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function notifyWorker(payload: Record<string, unknown>) {
  if (!workerConfigured()) return;
  try {
    await workerFetch("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // ponytail: fire-and-forget warmup; stitch/last_frame wait below
  }
}

export async function workerLastFrame(id: string, videoUri: string) {
  const res = await workerFetch("/jobs", {
    method: "POST",
    body: JSON.stringify({ type: "last_frame", id: `${id}-frame`, videoUri }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error("last-frame failed");
  return (await res.json()) as { mimeType: string; data: string };
}

export async function workerStitch(payload: {
  id: string;
  videoUris: string[];
  durationSec?: number;
}) {
  const res = await workerFetch("/jobs", {
    method: "POST",
    body: JSON.stringify({ type: "stitch", ...payload }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error("stitch failed");
  return (await res.json()) as { id: string; ready?: boolean };
}

export async function workerFile(id: string) {
  if (!workerConfigured()) return null;
  try {
    const res = await workerFetch(`/jobs/${encodeURIComponent(id)}/file`, {
      method: "GET",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

export async function workerHealth() {
  if (!env.WORKER_URL) return { status: "unconfigured" as const };
  try {
    const res = await fetch(new URL("/health", env.WORKER_URL), {
      signal: AbortSignal.timeout(4000),
    });
    return { status: res.ok ? ("ok" as const) : ("error" as const) };
  } catch {
    return { status: "error" as const };
  }
}
