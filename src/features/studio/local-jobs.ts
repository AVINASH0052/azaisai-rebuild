import { storageKey } from "./local-owner";

export type LocalJob = {
  id: string;
  kind: "video" | "image";
  modelId: string;
  modelLabel: string;
  prompt: string;
  aspect: string;
  cost: number;
  createdAt: number;
  status: "queued" | "processing" | "ready" | "failed";
  outputUrl?: string;
  outputUrls?: string[];
  clipSecs?: number[];
};

const KEY = "azai.jobs";

export function loadJobs(): LocalJob[] {
  if (typeof window === "undefined") return [];
  const key = storageKey(KEY);
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocalJob[]) : [];
  } catch {
    return [];
  }
}

export function saveJob(job: LocalJob) {
  const key = storageKey(KEY);
  if (!key) return;
  const next = [job, ...loadJobs().filter((j) => j.id !== job.id)].slice(0, 40);
  window.localStorage.setItem(key, JSON.stringify(next));
}
