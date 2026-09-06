import { generateText } from "@/lib/google-ai";

export async function enhancePrompt(input: {
  prompt: string;
  kind?: "video" | "image";
  modelId?: string;
}) {
  const kind = input.kind ?? "video";
  const modelHint = input.modelId ? ` Target model: ${input.modelId}.` : "";
  return generateText(
    `Rewrite this ${kind} generation prompt so it is richer and more specific.${modelHint} Return only the rewritten prompt.\n\n${input.prompt}`,
  );
}

export async function variatePrompt(input: { prompt: string; kind?: "video" | "image" }) {
  const kind = input.kind ?? "video";
  const raw = await generateText(
    `Give exactly 3 alternative ${kind} prompts, numbered 1-3, based on this idea. No extra text.\n\n${input.prompt}`,
  );
  return raw
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)-]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}
