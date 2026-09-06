export type LimitKey =
  | "generations.per_minute"
  | "generations.per_day"
  | "generations.concurrent"
  | "spend.daily_cents"
  | "video.max_duration_seconds"
  | "video.max_resolution"
  | "models.allowed_tiers"
  | "models.denylist"
  | "storage.gb"
  | "prompt_assist.per_day"
  | "api.enabled"
  | "api.per_minute"
  | "output.watermark"
  | "share.enabled"
  | "batch.max_models";

export type LimitValue = number | boolean | string | string[];
export type LimitSource = "platform" | "plan" | "override" | "clamp";

export type EffectivePolicy = {
  limits: Record<LimitKey, LimitValue>;
  state: "active" | "throttled" | "suspended" | "read_only";
  source: Record<LimitKey, LimitSource>;
  version: number;
  expiresAt: string | null;
};

export const PLATFORM_DEFAULTS: Record<LimitKey, LimitValue> = {
  "generations.per_minute": 2,
  "generations.per_day": 5,
  "generations.concurrent": 1,
  "spend.daily_cents": 50,
  "video.max_duration_seconds": 4,
  "video.max_resolution": "720p",
  "models.allowed_tiers": ["fast"],
  "models.denylist": [],
  "storage.gb": 1,
  "prompt_assist.per_day": 10,
  "api.enabled": false,
  "api.per_minute": 0,
  "output.watermark": true,
  "share.enabled": true,
  "batch.max_models": 2,
};
