import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export function googleAiConfigured() {
  return Boolean(env.GOOGLE_AI_STUDIO);
}

export async function generateText(prompt: string) {
  const key = env.GOOGLE_AI_STUDIO;
  if (!key) {
    throw new AppError("PROVIDER_UNAVAILABLE", "Google AI is not configured.");
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GOOGLE_AI_MODEL}:generateContent`,
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
  if (!res.ok) {
    throw new AppError("PROVIDER_UNAVAILABLE", "Google AI request failed.");
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
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
