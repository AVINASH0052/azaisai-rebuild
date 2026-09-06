import { env } from "./env";

export async function notifyWorker(payload: Record<string, unknown>) {
  if (!env.WORKER_URL || !env.WORKER_SECRET) return;
  try {
    await fetch(new URL("/jobs", env.WORKER_URL), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WORKER_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // ponytail: fire-and-forget; Cloud Scheduler is the retry path
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
