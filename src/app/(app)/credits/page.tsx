"use client";

import { useEffect, useState } from "react";
import {
  formatCredits,
  readCredits,
} from "@/features/studio/credits-store";

export default function CreditsPage() {
  const [balance, setBalance] = useState(0);
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
    <main className="p-6">
      <div className="rounded-3xl border border-border bg-bg-elevated px-6 py-10 shadow-card">
        <h1 className="text-3xl text-fg">Credits</h1>
        <p className="mt-3 font-mono text-4xl text-fg">{formatCredits(balance)}</p>
        <p className="mt-1 text-sm text-fg-muted">
          New accounts start with 80 credits. A 6s Veo Fast clip costs 9.
        </p>
      </div>
    </main>
  );
}
