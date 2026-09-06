"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DURATION_PRESETS,
  MAX_VIDEO_SEC,
  MIN_VIDEO_SEC,
  clampDuration,
  clipPlan,
} from "@/providers/long-video";
import { modelsFor, type Kind } from "@/providers/registry";
import { quoteCredits } from "@/providers/quote";

const LINES = [
  "A copper kettle beginning to speak",
  "Dust turning in a shaft of kitchen light",
  "Two coats on a chair, still warm",
  "The last tram drawing a wet line home",
  "Hands splitting kindling over newspaper",
];

export function Bench() {
  const [kind, setKind] = useState<Kind>("video");
  const models = useMemo(() => modelsFor(kind), [kind]);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const model = models.find((m) => m.id === modelId) ?? models[0];
  const [duration, setDuration] = useState(10);
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState("");
  const [spot, setSpot] = useState({ x: 70, y: 40 });

  useEffect(() => {
    if (!models.some((m) => m.id === modelId)) setModelId(models[0]?.id ?? "");
  }, [kind, modelId, models]);

  useEffect(() => {
    const full = LINES[line % LINES.length];
    setTyped("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(id);
        window.setTimeout(() => setLine((n) => n + 1), 2200);
      }
    }, 38);
    return () => window.clearInterval(id);
  }, [line]);

  const atoms = useMemo(() => clipPlan(duration), [duration]);
  const cost = model ? quoteCredits(model, kind === "video" ? duration : undefined) : 0;

  return (
    <section
      id="bench"
      className="relative isolate min-h-[calc(100svh-3.5rem)] overflow-hidden px-5 py-10 lg:px-10"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setSpot({
          x: ((e.clientX - r.left) / r.width) * 100,
          y: ((e.clientY - r.top) / r.height) * 100,
        });
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(520px 380px at ${spot.x}% ${spot.y}%, rgb(224 184 74 / 0.32), transparent 58%)`,
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="font-mono text-[11px] tracking-[0.28em] text-[var(--lab-gold)]">
            35MM HEARTH
          </p>
          <h1 className="mt-5 max-w-[14ch] font-heading text-[3.2rem] leading-[0.95] text-[var(--lab-ink)] sm:text-6xl lg:text-[5.4rem]">
            Ten seconds means ten.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--lab-muted)]">
            Veo will only mint 4, 6, or 8. We split to the length you named,
            then join the pieces before you see them. No Sora costume. No
            Runway ghost.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/auth/login"
              className="rounded-full bg-[var(--lab-cream)] px-5 py-2.5 text-sm text-[var(--lab-deep)] hover:bg-white"
            >
              Strike a match, 80 credits
            </Link>
            <a href="#gate" className="font-mono text-xs text-[var(--lab-gold)] underline-offset-4 hover:underline">
              Work the gate first
            </a>
          </div>
        </div>

        <div id="gate" className="film-gate">
          <div className="film-gate-flicker" />
          <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--lab-gold)]">
            IN THE GATE
          </p>
          <p className="mt-4 min-h-[4.5rem] font-heading text-2xl leading-snug text-[var(--lab-ink)]">
            {typed}
            <span className="ml-0.5 inline-block w-2 animate-pulse bg-[var(--lab-gold)] align-middle">
              &nbsp;
            </span>
          </p>
          <div className="mt-6 flex gap-2">
            {(["video", "image"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase ${
                  kind === k ? "bg-[var(--lab-cream)] text-[var(--lab-deep)]" : "bg-white/10 text-[var(--lab-muted)]"
                }`}
              >
                {k === "video" ? "Motion" : "Still"}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModelId(m.id)}
                className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${
                  model?.id === m.id
                    ? "border-[var(--lab-gold)] bg-[var(--lab-gold)]/20 text-[var(--lab-ink)]"
                    : "border-white/15 text-[var(--lab-muted)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {kind === "video" ? (
            <>
              <div className="mt-6 flex items-baseline justify-between">
                <label className="font-mono text-[11px] text-[var(--lab-muted)]" htmlFor="bench-duration">
                  Length on the bench
                </label>
                <span className="font-heading text-3xl text-[var(--lab-ink)]">{duration}s</span>
              </div>
              <input
                id="bench-duration"
                type="range"
                min={MIN_VIDEO_SEC}
                max={MAX_VIDEO_SEC}
                value={duration}
                onChange={(e) => setDuration(clampDuration(Number(e.target.value)))}
                className="mt-2 w-full accent-[var(--lab-gold)]"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`font-mono text-[11px] ${
                      duration === d ? "text-[var(--lab-gold)]" : "text-[var(--lab-dim)]"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <ol className="mt-5 flex gap-1.5">
                {atoms.map((atom) => (
                  <li
                    key={`${atom.index}-${atom.veoSec}`}
                    className="flex h-16 flex-1 flex-col justify-between rounded-sm border border-[var(--lab-gold)]/40 bg-[var(--lab-gold)]/15 px-2 py-1.5"
                  >
                    <span className="font-mono text-[10px] text-[var(--lab-gold)]">
                      {atom.index + 1}
                    </span>
                    <span className="font-heading text-xl text-[var(--lab-ink)]">{atom.veoSec}s</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 font-mono text-[11px] text-[var(--lab-dim)]">
                {atoms.map((a) => a.veoSec).join(" + ")} = {duration} delivered
              </p>
            </>
          ) : (
            <p className="mt-6 font-mono text-sm text-[var(--lab-muted)]">
              One still. Gemini Flash Image. No catalogue filler.
            </p>
          )}
          <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-4">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-[var(--lab-dim)]">BURN</p>
              <p className="mt-1 flex flex-wrap gap-1" aria-label={`${cost} credits`}>
                {Array.from({ length: Math.min(cost, 24) }, (_, i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-[var(--lab-gold)] shadow-[0_0_8px_var(--lab-gold)]"
                  />
                ))}
              </p>
            </div>
            <p className="font-heading text-4xl text-[var(--lab-ink)]">{cost}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
