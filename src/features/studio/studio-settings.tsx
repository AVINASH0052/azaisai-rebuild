"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DURATION_PRESETS } from "@/providers/long-video";
import { IMAGE_STYLES, modelsFor } from "@/providers/registry";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type StudioPrefs } from "./prefs";

const field =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

const pill = (on: boolean) =>
  `rounded-full px-3 py-1 text-sm ${
    on ? "bg-ink text-bg-elevated" : "bg-bg-inset text-fg-muted hover:text-fg"
  }`;

export function StudioSettings() {
  const [prefs, setPrefs] = useState<StudioPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const sync = () => setPrefs(loadPrefs());
    sync();
    window.addEventListener("azai-owner", sync);
    return () => window.removeEventListener("azai-owner", sync);
  }, []);
  const videoModels = useMemo(() => modelsFor("video"), []);
  const imageModels = useMemo(() => modelsFor("image"), []);
  const video = videoModels.find((m) => m.id === prefs.videoModelId) ?? videoModels[0];
  const image = imageModels.find((m) => m.id === prefs.imageModelId) ?? imageModels[0];

  function patch(next: Partial<StudioPrefs>) {
    setPrefs((cur) => ({ ...cur, ...next }));
    setSaved(false);
  }

  return (
    <form
      className="mt-6 space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        setPrefs(savePrefs(prefs));
        setSaved(true);
      }}
    >
      <div>
        <h2 className="text-lg text-fg">Video generation</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Defaults for Studio when you open Video.
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm text-fg-muted">Model</span>
          <select
            className={field}
            value={prefs.videoModelId}
            onChange={(e) => {
              const model = videoModels.find((m) => m.id === e.target.value);
              const aspect = model?.capabilities.aspects.includes(prefs.videoAspect)
                ? prefs.videoAspect
                : (model?.capabilities.aspects[0] ?? prefs.videoAspect);
              patch({ videoModelId: e.target.value, videoAspect: aspect });
            }}
          >
            {videoModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-4 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Aspect
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(video?.capabilities.aspects ?? []).map((a) => (
            <button
              key={a}
              type="button"
              className={pill(prefs.videoAspect === a)}
              onClick={() => patch({ videoAspect: a })}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Length
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              className={pill(prefs.videoDurationSec === d)}
              onClick={() => patch({ videoDurationSec: d })}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg text-fg">Image generation</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Defaults for Studio when you open Image.
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm text-fg-muted">Model</span>
          <select
            className={field}
            value={prefs.imageModelId}
            onChange={(e) => {
              const model = imageModels.find((m) => m.id === e.target.value);
              const aspect = model?.capabilities.aspects.includes(prefs.imageAspect)
                ? prefs.imageAspect
                : (model?.capabilities.aspects[0] ?? prefs.imageAspect);
              patch({ imageModelId: e.target.value, imageAspect: aspect });
            }}
          >
            {imageModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-4 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Aspect
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(image?.capabilities.aspects ?? []).map((a) => (
            <button
              key={a}
              type="button"
              className={pill(prefs.imageAspect === a)}
              onClick={() => patch({ imageAspect: a })}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Style
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {IMAGE_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              className={pill(prefs.imageStyle === s)}
              onClick={() => patch({ imageStyle: s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" className="h-11 w-full">
        {saved ? "Saved" : "Save generation defaults"}
      </Button>
    </form>
  );
}
