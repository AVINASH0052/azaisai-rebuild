import {
  clampDuration,
  DURATION_PRESETS,
} from "@/providers/long-video";
import { IMAGE_STYLES, modelsFor, type Kind } from "@/providers/registry";
import { storageKey } from "./local-owner";

const KEY = "azai.studio.prefs";

export type StudioPrefs = {
  videoModelId: string;
  videoAspect: string;
  videoDurationSec: number;
  imageModelId: string;
  imageAspect: string;
  imageStyle: string;
};

export const DEFAULT_PREFS: StudioPrefs = {
  videoModelId: "veo-3-fast",
  videoAspect: "16:9",
  videoDurationSec: 6,
  imageModelId: "nano-banana-2",
  imageAspect: "1:1",
  imageStyle: "None",
};

function liveId(kind: Kind, id: string) {
  const live = modelsFor(kind);
  return live.find((m) => m.id === id)?.id ?? live[0]?.id ?? id;
}

function liveAspect(kind: Kind, modelId: string, aspect: string) {
  const model = modelsFor(kind).find((m) => m.id === modelId);
  const aspects = model?.capabilities.aspects ?? [];
  return aspects.includes(aspect) ? aspect : (aspects[0] ?? aspect);
}

function liveStyle(value: string) {
  return (IMAGE_STYLES as readonly string[]).includes(value)
    ? value
    : DEFAULT_PREFS.imageStyle;
}

export function sanitizePrefs(raw: Partial<StudioPrefs> | null | undefined): StudioPrefs {
  const merged = { ...DEFAULT_PREFS, ...raw };
  const videoModelId = liveId("video", merged.videoModelId);
  const imageModelId = liveId("image", merged.imageModelId);
  const duration = DURATION_PRESETS.includes(
    merged.videoDurationSec as (typeof DURATION_PRESETS)[number],
  )
    ? merged.videoDurationSec
    : clampDuration(merged.videoDurationSec);
  return {
    videoModelId,
    videoAspect: liveAspect("video", videoModelId, merged.videoAspect),
    videoDurationSec: duration,
    imageModelId,
    imageAspect: liveAspect("image", imageModelId, merged.imageAspect),
    imageStyle: liveStyle(merged.imageStyle),
  };
}

export function loadPrefs(): StudioPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  const key = storageKey(KEY);
  if (!key) return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(key);
    return sanitizePrefs(raw ? (JSON.parse(raw) as Partial<StudioPrefs>) : null);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(patch: Partial<StudioPrefs>) {
  const key = storageKey(KEY);
  const next = sanitizePrefs({ ...loadPrefs(), ...patch });
  if (!key) return next;
  window.localStorage.setItem(key, JSON.stringify(next));
  return next;
}
