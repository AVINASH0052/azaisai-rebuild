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
};

const KEY = "azai.jobs";

export function loadJobs(): LocalJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalJob[]) : [];
  } catch {
    return [];
  }
}

export function saveJob(job: LocalJob) {
  const next = [job, ...loadJobs().filter((j) => j.id !== job.id)].slice(0, 40);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}
