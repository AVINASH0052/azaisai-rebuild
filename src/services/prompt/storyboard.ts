import { generateText, googleAiConfigured } from "@/lib/google-ai";
import {
  type Beat,
  beatWindows,
  fallbackBeats,
  segmentCount,
} from "@/providers/long-video";

function parseBeats(raw: string, durationSec: number): Beat[] | null {
  const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(json) as { prompt?: string }[];
    const windows = beatWindows(durationSec);
    if (!Array.isArray(parsed) || parsed.length !== windows.length) return null;
    return windows.map((w, i) => ({
      ...w,
      prompt: String(parsed[i]?.prompt ?? "").trim(),
    }));
  } catch {
    return null;
  }
}

export async function planStoryboard(input: {
  prompt: string;
  durationSec: number;
}): Promise<Beat[]> {
  const n = segmentCount(input.durationSec);
  if (n <= 1) return fallbackBeats(input.prompt, input.durationSec);
  const windows = beatWindows(input.durationSec);
  const last = windows[windows.length - 1];
  if (!googleAiConfigured()) return fallbackBeats(input.prompt, input.durationSec);

  const raw = await generateText(
    `Split this into ${n} consecutive beats of ONE continuous scene. Beat 2+ continues from the last frame of the previous beat — do not restart the shot. The last beat must fully resolve in ${last.contentSec} seconds because it will be trimmed. Return ONLY a JSON array of ${n} objects: [{"prompt":"..."}]. No markdown.\n\n${input.prompt}`,
  );
  return parseBeats(raw, input.durationSec) ?? fallbackBeats(input.prompt, input.durationSec);
}
