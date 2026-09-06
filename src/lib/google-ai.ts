import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
];

export function googleAiConfigured() {
  return Boolean(env.GOOGLE_AI_STUDIO);
}

async function generateOnce(model: string, prompt: string, key: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  if (!res.ok) {
    throw new AppError(
      res.status === 429 ? "SPEND_CAP_REACHED" : "PROVIDER_UNAVAILABLE",
      data.error?.message ?? "Google AI request failed.",
    );
  }
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";
  if (!text) {
    throw new AppError("PROVIDER_UNAVAILABLE", "Google AI returned an empty reply.");
  }
  return text;
}

export async function generateText(prompt: string) {
  const key = env.GOOGLE_AI_STUDIO;
  if (!key) {
    throw new AppError("PROVIDER_UNAVAILABLE", "Google AI is not configured.");
  }
  const models = [env.GOOGLE_AI_MODEL, ...FALLBACK_MODELS.filter((m) => m !== env.GOOGLE_AI_MODEL)];
  let last: AppError | null = null;
  for (const model of models) {
    try {
      return await generateOnce(model, prompt, key);
    } catch (err) {
      last = err instanceof AppError ? err : new AppError("PROVIDER_UNAVAILABLE", "Google AI request failed.");
    }
  }
  throw last ?? new AppError("PROVIDER_UNAVAILABLE", "Google AI request failed.");
}
