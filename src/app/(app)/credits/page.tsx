"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pullCredits } from "@/features/studio/credits-client";
import { formatCredits, readCredits } from "@/features/studio/credits-store";
import { loadJobs, type LocalJob } from "@/features/studio/local-jobs";
import { STARTING_CREDITS, spentFrom } from "@/services/credits/meter";

export default function CreditsPage() {
  const [balance, setBalance] = useState(0);
  const [jobs, setJobs] = useState<LocalJob[]>([]);
  useEffect(() => {
    void pullCredits().then(setBalance);
    setJobs(loadJobs());
    const sync = () => {
      setBalance(readCredits());
      setJobs(loadJobs());
    };
    window.addEventListener("azai-credits", sync);
    window.addEventListener("azai-owner", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("azai-credits", sync);
      window.removeEventListener("azai-owner", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const used = spentFrom(balance);
  const billed = jobs
    .filter((j) => j.status === "ready")
    .reduce((sum, j) => sum + j.cost, 0);

  return (
    <main className="p-6">
      <div className="rounded-3xl border border-border bg-bg-elevated px-6 py-10 shadow-card">
        <h1 className="text-3xl text-fg">Credits</h1>
        <p className="mt-3 font-mono text-4xl text-fg">{formatCredits(balance)}</p>
        <p className="mt-1 text-sm text-fg-muted">
          {used} used of {STARTING_CREDITS} signup credits. A 6s Veo Fast clip
          costs 9.
        </p>
        {balance < 9 ? (
          <p className="mt-3 text-sm text-danger">
            Not enough credits for a 6s video. Image still works if you have at
            least 1.
          </p>
        ) : null}

        <h2 className="mt-8 text-lg text-fg">Usage</h2>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">
            Nothing billed yet.{" "}
            <Link className="text-accent underline-offset-4 hover:underline" href="/studio/video">
              Generate a video
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm text-fg">{job.prompt}</p>
                  <p className="font-mono text-xs text-fg-subtle">
                    {job.modelLabel}, {job.kind}, {job.status}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-fg">
                  {job.status === "failed" ? "returned" : `−${job.cost} cr`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {jobs.length > 0 ? (
          <p className="mt-3 font-mono text-xs text-fg-subtle">
            This device billed {billed} cr on finished jobs.
          </p>
        ) : null}
      </div>
    </main>
  );
}
