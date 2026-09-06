import type { Model } from "./registry";

export function quoteCredits(model: Model, durationSec?: number) {
  if (model.credits.per === "second") {
    const sec = durationSec ?? model.capabilities.durations?.[0] ?? 4;
    return Math.ceil(model.credits.rate * sec);
  }
  return model.credits.rate;
}
