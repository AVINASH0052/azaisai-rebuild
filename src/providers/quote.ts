import { generatedSeconds } from "./long-video";
import type { Model } from "./registry";

export function quoteCredits(model: Model, durationSec?: number) {
  if (model.credits.per === "image") return model.credits.rate;
  const duration = durationSec ?? model.capabilities.durations?.[0] ?? 8;
  return Math.ceil(model.credits.rate * generatedSeconds(duration));
}
