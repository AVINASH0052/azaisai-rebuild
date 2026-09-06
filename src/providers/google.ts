import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { googleAiConfigured } from "@/lib/google-ai";
import type { Model } from "./registry";
import type { ArtifactRef, ProviderHandle, ProviderStatus } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export type SeedImage = { mimeType: string; data: string };

export type VeoSubmit = {
  prompt: string;
  aspect: string;
  durationSec?: number;
  seedImage?: SeedImage;
};

function key() {
  const k = env.GOOGLE_AI_STUDIO;
  if (!k) throw new AppError("PROVIDER_UNAVAILABLE", "Google AI is not configured.");
  return k;
}

function headers() {
  return { "Content-Type": "application/json", "x-goog-api-key": key() };
}

function throwIfQuota(res: Response, fallback: string) {
  if (res.status === 429) {
    throw new AppError("SPEND_CAP_REACHED", "Daily Google quota is used up.");
  }
  if (!res.ok) throw new AppError("PROVIDER_UNAVAILABLE", fallback);
}

export function googleLive(model: Model) {
  return (
    env.PROVIDER_MODE !== "mock" &&
    model.availability === "live" &&
    Boolean(model.providerModel) &&
    googleAiConfigured()
  );
}

export function friendlyVeoMessage(raw?: string) {
  const text = raw?.trim() ?? "";
  if (/internal server/i.test(text)) {
    return "Veo failed on Google's side (quota or a temporary outage). The first clip never finished. Wait a minute and try again.";
  }
  return text || "Veo failed.";
}

export function veoPredictBody(req: VeoSubmit & { resolution?: string }) {
  const instance: Record<string, unknown> = { prompt: req.prompt };
  if (req.seedImage) {
    instance.image = {
      bytesBase64Encoded: req.seedImage.data,
      mimeType: req.seedImage.mimeType,
    };
  }
  const duration = req.durationSec ?? 8;
  const durationSeconds = duration <= 4 ? 4 : duration <= 6 ? 6 : 8;
  const parameters: Record<string, unknown> = {
    aspectRatio: req.aspect === "9:16" ? "9:16" : "16:9",
    durationSeconds,
    sampleCount: 1,
  };
  if (req.resolution) parameters.resolution = req.resolution;
  return { instances: [instance], parameters };
}

export function videoUriFromOperation(data: unknown): string | undefined {
  const root = data as {
    response?: {
      generateVideoResponse?: {
        generatedSamples?: { video?: { uri?: string; bytesBase64Encoded?: string } }[];
      };
      videos?: { gcsUri?: string; uri?: string }[];
      predictions?: { bytesBase64Encoded?: string }[];
    };
  };
  const sample = root.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
  if (sample?.uri) return sample.uri;
  if (sample?.bytesBase64Encoded) return `data:video/mp4;base64,${sample.bytesBase64Encoded}`;
  const listed = root.response?.videos?.[0];
  return listed?.uri ?? listed?.gcsUri;
}

export async function generateGoogleImage(model: Model, prompt: string) {
  const id = model.providerModel;
  if (!id) throw new AppError("PROVIDER_UNAVAILABLE", "No Google model mapped.");
  const res = await fetch(`${BASE}/models/${id}:generateContent`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });
  throwIfQuota(res, "Gemini image request failed.");
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
  };
  const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new AppError("PROVIDER_UNAVAILABLE", "Gemini returned no image.");
  return `data:${inline.mimeType ?? "image/png"};base64,${inline.data}`;
}

export async function submitGoogleVideo(
  model: Model,
  req: VeoSubmit,
): Promise<ProviderHandle> {
  const id = model.providerModel;
  if (!id) throw new AppError("PROVIDER_UNAVAILABLE", "No Google model mapped.");
  const resolution = model.id.startsWith("veo-2") ? undefined : "720p";
  let last: AppError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`${BASE}/models/${id}:predictLongRunning`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(veoPredictBody({ ...req, resolution })),
    });
    if (res.status === 429) {
      throw new AppError("SPEND_CAP_REACHED", "Daily Google quota is used up.");
    }
    const data = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
    if (res.ok && data.name) return { provider: "google", jobId: data.name };
    last = new AppError("PROVIDER_UNAVAILABLE", friendlyVeoMessage(data.error?.message ?? "Veo request failed."));
  }
  throw last ?? new AppError("PROVIDER_UNAVAILABLE", "Veo request failed.");
}

export async function pollGoogle(handle: ProviderHandle): Promise<ProviderStatus> {
  const res = await fetch(`${BASE}/${handle.jobId}`, { headers: headers() });
  if (res.status === 429) {
    return {
      state: "failed",
      code: "quota_exceeded",
      message: "Daily Google quota is used up.",
      billable: false,
    };
  }
  if (!res.ok) {
    return { state: "failed", code: "provider_error", message: "Veo poll failed.", billable: false };
  }
  const data = (await res.json()) as { done?: boolean; error?: { message?: string } };
  if (data.error) {
    return {
      state: "failed",
      code: "provider_error",
      message: friendlyVeoMessage(data.error.message),
      billable: false,
    };
  }
  if (!data.done) return { state: "processing", stage: "Veo rendering" };
  const uri = videoUriFromOperation(data);
  if (!uri) {
    return {
      state: "failed",
      code: "provider_error",
      message: "Veo finished with no file.",
      billable: false,
    };
  }
  return { state: "succeeded", artifacts: [{ url: uri, role: "output" }] };
}

export function byteRange(header: string | null, total: number) {
  if (total <= 0) return { start: 0, end: 0, status: 200 as const };
  if (!header) return { start: 0, end: total - 1, status: 200 as const };
  const m = /bytes=(\d+)-(\d*)/.exec(header);
  if (!m) return { start: 0, end: total - 1, status: 200 as const };
  const start = Math.min(Number(m[1]), total - 1);
  const end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
  if (start > end) return { start: 0, end: total - 1, status: 200 as const };
  const partial = start > 0 || end < total - 1;
  return { start, end, status: (partial ? 206 : 200) as 200 | 206 };
}

export async function fetchGoogleMedia(uri: string, range?: string | null) {
  const headers: Record<string, string> = { "x-goog-api-key": key() };
  if (range) headers.Range = range;
  const res = await fetch(uri, { headers });
  throwIfQuota(res, "Could not download the generated file.");
  return res;
}

export async function resolveGoogle(status: ProviderStatus): Promise<ArtifactRef[]> {
  if (status.state !== "succeeded") return [];
  return status.artifacts;
}
