"use client";

import { useEffect, useState } from "react";
import { formatCredits, readCredits } from "./credits-store";

export function CreditChip({ fallback }: { fallback: number }) {
  const [balance, setBalance] = useState(fallback);
  useEffect(() => {
    const sync = () => setBalance(readCredits());
    sync();
    window.addEventListener("azai-credits", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("azai-credits", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return (
    <span
      className="rounded-full border border-border bg-bg-inset px-3 py-1 font-mono text-sm text-fg"
      aria-label={`${formatCredits(balance)} credits`}
    >
      {formatCredits(balance)} cr
    </span>
  );
}
