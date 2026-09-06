"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { IMAGE_STYLES, modelsFor, type Kind } from "@/providers/registry";
import { quoteCredits } from "@/providers/quote";
import {
  type Beat,
  DURATION_PRESETS,
  MAX_VIDEO_SEC,
  MIN_VIDEO_SEC,
  clampDuration,
  fallbackBeats,
  segmentCount,
} from "@/providers/long-video";
import {
  debitCredits,
  formatCredits,
  readCredits,
  refundCredits,
  unlimitedCredits,
} from "./credits-store";
import { loadJobs, saveJob } from "./local-jobs";
import { captureLastFrame } from "./last-frame";

const field =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

function assetUrl(kind: Kind, prompt: string, aspect: string, modelId: string) {
  const q = new URLSearchParams({ prompt, aspect, model: modelId, kind });
  return `/api/mock-asset?${q}`;
}

export function Studio({ mode }: { mode: Kind }) {
  const models = modelsFor(mode);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const model = models.find((m) => m.id === modelId) ?? models[0];
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState(model?.capabilities.aspects[0] ?? "16:9");
  const [durationSec, setDurationSec] = useState(6);
  const [style, setStyle] = useState<(typeof IMAGE_STYLES)[number]>("None");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    id: string;
    kind: Kind;
    poster: string;
    video?: string;
    videos?: string[];
    live?: boolean;
  } | null>(null);
  const [balance, setBalance] = useState(5);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [planning, setPlanning] = useState(false);

  const segments = mode === "video" ? segmentCount(durationSec) : 1;

  useEffect(() => {
    setBalance(readCredits());
    const sync = () => setBalance(readCredits());
    window.addEventListener("azai-credits", sync);
    return () => window.removeEventListener("azai-credits", sync);
  }, []);

  useEffect(() => {
    if (!model) return;
    if (!model.capabilities.aspects.includes(aspect)) {
      setAspect(model.capabilities.aspects[0]);
    }
  }, [model, aspect]);

  useEffect(() => {
    setBeats([]);
  }, [durationSec]);

  useEffect(() => {
    const last = loadJobs().find(
      (j) => j.kind === mode && j.status === "ready" && (j.outputUrls?.length || j.outputUrl),
    );
    if (!last) return;
    const clips =
      last.kind === "video"
        ? (last.outputUrls?.length ? last.outputUrls : last.outputUrl ? [last.outputUrl] : undefined)
        : undefined;
    setResult({
      id: last.id,
      kind: last.kind,
      poster:
        last.kind === "image"
          ? (last.outputUrl ?? assetUrl(last.kind, last.prompt, last.aspect, last.modelId))
          : assetUrl(last.kind, last.prompt, last.aspect, last.modelId),
      video: clips?.[0],
      videos: clips,
      live: last.id.startsWith("g_"),
    });
  }, [mode]);

  const cost = useMemo(
    () => (model ? quoteCredits(model, mode === "video" ? durationSec : undefined) : 0),
    [model, mode, durationSec],
  );
  const canAfford = unlimitedCredits() || balance >= cost;

  async function planBeats() {
    if (!prompt.trim() || mode !== "video" || segments <= 1) return;
    setPlanning(true);
    setError(null);
    try {
      const res = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), durationSec }),
      });
      const json = (await res.json()) as { beats?: Beat[]; error?: { message: string } };
      if (!res.ok || !json.beats) {
        setBeats(fallbackBeats(prompt.trim(), durationSec));
        return;
      }
      setBeats(json.beats);
    } catch {
      setBeats(fallbackBeats(prompt.trim(), durationSec));
    } finally {
      setPlanning(false);
    }
  }

  async function enhance() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/prompt/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, kind: mode, modelId }),
        signal: AbortSignal.timeout(25_000),
      });
      const json = (await res.json()) as { enhanced?: string; error?: { message: string } };
      if (!res.ok || !json.enhanced) {
        setError(json.error?.message ?? "Could not enhance that prompt.");
        return;
      }
      setPrompt(json.enhanced);
    } catch {
      setError("Could not enhance that prompt. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!model || !prompt.trim() || !canAfford) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setStage("Queued");
    setProgress(0);
    debitCredits(cost);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt: prompt.trim(),
          kind: mode,
          aspect,
          durationSec: mode === "video" ? durationSec : undefined,
          style: mode === "image" ? style : undefined,
          storyboard:
            mode === "video" && segments > 1
              ? (beats.length === segments
                  ? beats
                  : fallbackBeats(prompt.trim(), durationSec))
              : undefined,
        }),
      });
      const json = (await res.json()) as {
        id?: string;
        provider?: string;
        status?: string;
        outputUrl?: string;
        outputUrls?: string[];
        operation?: string;
        segments?: number;
        error?: { message: string };
      };
      if (!res.ok || !json.id) {
        refundCredits(cost);
        setError(json.error?.message ?? "Could not start that generation.");
        setStage(null);
        return;
      }
      const jobId = json.id;
      const live = json.provider === "google";
      saveJob({
        id: jobId,
        kind: mode,
        modelId: model.id,
        modelLabel: model.label,
        prompt: prompt.trim(),
        aspect,
        cost,
        createdAt: Date.now(),
        status: "queued",
      });
      const finish = (outputUrl?: string, outputUrls?: string[]) => {
        const clips =
          mode === "video"
            ? (outputUrls?.length ? outputUrls : [outputUrl ?? "/mock/flower.mp4"])
            : undefined;
        const poster =
          mode === "image"
            ? (outputUrl ?? assetUrl(mode, prompt.trim(), aspect, model.id))
            : assetUrl(mode, prompt.trim(), aspect, model.id);
        setResult({
          id: jobId,
          kind: mode,
          poster,
          video: clips?.[0],
          videos: clips,
          live,
        });
        saveJob({
          id: jobId,
          kind: mode,
          modelId: model.id,
          modelLabel: model.label,
          prompt: prompt.trim(),
          aspect,
          cost,
          createdAt: Date.now(),
          status: "ready",
          outputUrl: mode === "image" ? outputUrl : clips?.[0],
          outputUrls: clips,
        });
      };
      if (json.status === "ready") {
        finish(json.outputUrl, json.outputUrls);
        return;
      }
      if (live && !json.operation) {
        refundCredits(cost);
        setError("Google did not return a Veo operation.");
        return;
      }
      let operation = json.operation;
      let segment = 0;
      let videoUris: string[] = [];
      let completedOps: string[] = [];
      let seedImage: { mimeType: string; data: string } | undefined;
      for (;;) {
        if (!seedImage) await new Promise((r) => setTimeout(r, live ? 2000 : 350));
        const poll = live
          ? await fetch("/api/generations/progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: jobId,
                modelId: model.id,
                aspect,
                durationSec: mode === "video" ? durationSec : undefined,
                operation,
                segment,
                segments: json.segments ?? segments,
                videoUris,
                completedOps,
                seedImage,
                storyboard:
                  mode === "video" && segments > 1
                    ? (beats.length === segments
                        ? beats
                        : fallbackBeats(prompt.trim(), durationSec))
                    : undefined,
              }),
            })
          : await fetch(`/api/generations/${jobId}`);
        seedImage = undefined;
        const body = (await poll.json()) as {
          status?: string;
          progress?: number;
          stage?: string;
          outputUrl?: string;
          outputUrls?: string[];
          lastUrl?: string;
          operation?: string;
          segment?: number;
          videoUris?: string[];
          completedOps?: string[];
          error?: { message: string };
        };
        if (!poll.ok) {
          refundCredits(cost);
          setError(body.error?.message ?? "Generation failed. Credits returned.");
          break;
        }
        setProgress(body.progress ?? 0);
        setStage(body.stage ?? body.status ?? "Working");
        if (body.operation) operation = body.operation;
        if (typeof body.segment === "number") segment = body.segment;
        if (body.videoUris) videoUris = body.videoUris;
        if (body.completedOps) completedOps = body.completedOps;
        if (body.status === "need_seed") {
          if (!body.lastUrl) {
            refundCredits(cost);
            setError("Could not load the last frame.");
            break;
          }
          setStage("Capturing last frame");
          try {
            seedImage = await captureLastFrame(body.lastUrl);
          } catch {
            refundCredits(cost);
            setError("Could not capture the last frame.");
            break;
          }
          continue;
        }
        if (body.status === "ready") {
          finish(body.outputUrl, body.outputUrls);
          break;
        }
        if (body.status === "failed") {
          refundCredits(cost);
          setError(body.stage ?? "Generation failed. Credits returned.");
          break;
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
      <section className="rounded-3xl border border-border bg-bg-elevated p-5 shadow-card">
        <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
          {mode}
        </p>
        <h1 className="mt-1 text-2xl text-fg">
          {mode === "video" ? "Video studio" : "Image studio"}
        </h1>

        <p className="mt-5 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Model
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {models.map((m) => {
            const selected = m.id === model?.id;
            const sample = quoteCredits(m, m.capabilities.durations?.[0]);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setModelId(m.id)}
                className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                  selected
                    ? "border-accent bg-bg-inset ring-2 ring-accent/30"
                    : "border-border hover:bg-bg-inset/70"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-fg">{m.label}</span>
                  {m.availability === "mock_only" || m.badge ? (
                    <span className="font-mono text-[10px] tracking-wide text-accent uppercase">
                      {m.availability === "mock_only" ? "Mock" : m.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block font-mono text-xs text-fg-subtle">
                  {m.vendor}
                  {m.credits.per === "second"
                    ? ` · ${m.credits.rate} cr/s`
                    : ` · ${sample} cr`}
                  {m.capabilities.audio ? " · audio" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Prompt
          </span>
          <textarea
            className={`${field} mt-2 min-h-28 resize-y`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void generate();
              }
            }}
            placeholder={
              mode === "video"
                ? "A bicycle rolling through honey-colored late light…"
                : "A still life of film canisters on sandstone…"
            }
          />
        </label>
        <button
          type="button"
          className="mt-2 text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline disabled:opacity-50"
          disabled={busy || !prompt.trim()}
          onClick={() => void enhance()}
        >
          Enhance prompt
        </button>

        <p className="mt-5 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Aspect
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(model?.capabilities.aspects ?? []).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAspect(a)}
              className={`rounded-full px-3 py-1 text-sm ${
                aspect === a
                  ? "bg-ink text-bg-elevated"
                  : "bg-bg-inset text-fg-muted hover:text-fg"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {mode === "video" ? (
          <>
            <p className="mt-4 text-xs font-medium tracking-wide text-fg-subtle uppercase">
              Length · {durationSec}s · max {MAX_VIDEO_SEC}s
            </p>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={MIN_VIDEO_SEC}
                max={MAX_VIDEO_SEC}
                value={durationSec}
                className="w-full accent-[var(--accent)]"
                onChange={(e) => setDurationSec(clampDuration(Number(e.target.value)))}
              />
              <input
                type="number"
                min={MIN_VIDEO_SEC}
                max={MAX_VIDEO_SEC}
                value={durationSec}
                className={`${field} w-16 py-1.5 text-center`}
                onChange={(e) => setDurationSec(clampDuration(Number(e.target.value)))}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationSec(d)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    durationSec === d
                      ? "bg-ink text-bg-elevated"
                      : "bg-bg-inset text-fg-muted hover:text-fg"
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </>
        ) : null}

        {mode === "video" && segments > 1 ? (
          <div className="mt-4 rounded-2xl border border-border bg-bg px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
                Storyboard
              </p>
              <button
                type="button"
                className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline disabled:opacity-50"
                disabled={planning || !prompt.trim()}
                onClick={() => void planBeats()}
              >
                {planning ? "Planning…" : beats.length ? "Replan" : "Plan beats"}
              </button>
            </div>
            <p className="mt-1 text-xs text-fg-subtle">
              Each beat starts from the last frame of the one before it. Clips
              play in order — no Cloud Run stitch.
            </p>
            {(beats.length ? beats : fallbackBeats(prompt.trim() || "…", durationSec)).map(
              (beat) => (
                <label key={beat.index} className="mt-3 block">
                  <span className="font-mono text-[11px] text-accent">
                    {beat.index + 1} · {beat.startSec}–{beat.endSec}s
                    {beat.contentSec < 8 ? " · trim" : ""}
                  </span>
                  <textarea
                    className={`${field} mt-1 min-h-16 resize-y text-sm`}
                    value={
                      beats[beat.index]?.prompt ??
                      (prompt.trim() ? beat.prompt : "")
                    }
                    onChange={(e) => {
                      const next = (
                        beats.length ? beats : fallbackBeats(prompt.trim(), durationSec)
                      ).map((b) =>
                        b.index === beat.index ? { ...b, prompt: e.target.value } : b,
                      );
                      setBeats(next);
                    }}
                  />
                </label>
              ),
            )}
          </div>
        ) : null}

        {mode === "image" ? (
          <>
            <p className="mt-4 text-xs font-medium tracking-wide text-fg-subtle uppercase">
              Style
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IMAGE_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    style === s
                      ? "bg-ink text-bg-elevated"
                      : "bg-bg-inset text-fg-muted hover:text-fg"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-6 rounded-2xl border border-border bg-bg-inset px-3 py-2 text-sm text-fg">
          Cost {cost} cr
          {mode === "video"
            ? ` · ${segments} × 8s · ${durationSec}s delivered`
            : ""}
          {" · "}
          {unlimitedCredits()
            ? "unlimited"
            : `balance ${formatCredits(balance)}${canAfford ? ` → ${balance - cost}` : " · not enough"}`}
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <Button
          type="button"
          size="lg"
          className="mt-3 h-11 w-full"
          disabled={busy || !prompt.trim() || !canAfford}
          onClick={() => void generate()}
        >
          {busy ? "Working…" : "Generate"}
        </Button>
        <p className="mt-2 text-center font-mono text-[11px] text-fg-subtle">
          ⌘↵ · {model?.availability === "live" ? "Google when live" : "mock"}
        </p>
      </section>

      <section className="flex min-h-[70vh] flex-col rounded-3xl border border-dashed border-border-strong bg-bg-elevated/80 p-4 shadow-card">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {result ? (
            <div className="w-full max-w-3xl">
              {result.videos?.length ? (
                <ClipPlaylist
                  id={result.id}
                  clips={result.videos}
                  poster={result.poster}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.poster}
                  alt={prompt}
                  className="mx-auto max-h-[70vh] w-full rounded-2xl object-contain"
                />
              )}
              <p className="mt-4 text-sm text-fg-muted">
                {result.live
                  ? mode === "video"
                    ? result.videos && result.videos.length > 1
                      ? "Veo clips chained from the last frame. They play in order."
                      : "Rendered with Veo."
                    : "Rendered with Gemini Flash Image."
                  : mode === "video"
                    ? "Sample clip while the live provider is mocked."
                    : "Still rendered from your prompt."}
              </p>
            </div>
          ) : stage ? (
            <div className="w-full max-w-md px-4">
              <p className="text-center text-fg">{stage}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-inset">
                <div
                  className="h-full bg-accent transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-center font-mono text-xs text-fg-subtle">
                {progress}%
              </p>
            </div>
          ) : (
            <p className="max-w-sm text-center text-fg-muted">
              Pick a model, write a prompt, generate. Output lands here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ClipPlaylist({
  id,
  clips,
  poster,
}: {
  id: string;
  clips: string[];
  poster: string;
}) {
  const [index, setIndex] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);
  const src = clips[index] ?? clips[0];
  return (
    <div>
      <video
        key={src}
        className="w-full rounded-2xl bg-ink"
        controls
        playsInline
        preload="auto"
        autoPlay={index > 0}
        poster={index === 0 ? poster : undefined}
        src={src}
        onError={() => setPlayError("The clip loaded, then the player lost the file. Try Download.")}
        onPlaying={() => setPlayError(null)}
        onEnded={() => {
          if (index + 1 < clips.length) setIndex(index + 1);
        }}
      />
      {playError ? <p className="mt-2 text-sm text-danger">{playError}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          className="rounded-full bg-ink px-4 py-2 text-sm text-bg-elevated"
          href={src}
          download={`hearth-${id}-${index + 1}.mp4`}
        >
          Download
        </a>
        {clips.length > 1 ? (
          <p className="font-mono text-xs text-fg-subtle">
            Clip {index + 1} of {clips.length}
          </p>
        ) : null}
      </div>
    </div>
  );
}
