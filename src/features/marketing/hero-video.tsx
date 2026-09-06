"use client";

import { useEffect, useRef } from "react";

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void el.play();
        else el.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className="aspect-video h-full w-full object-cover"
      src="/mock/flower.mp4"
      muted
      loop
      playsInline
      preload="none"
      poster="/api/mock-asset?prompt=Honey+light+on+a+field+of+flowers&aspect=16:9&model=veo-3-fast&kind=video"
    />
  );
}
