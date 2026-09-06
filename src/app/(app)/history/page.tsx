"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJobs, type LocalJob } from "@/features/studio/local-jobs";

export default function HistoryPage() {
  const [jobs, setJobs] = useState<LocalJob[]>([]);
  useEffect(() => {
    setJobs(loadJobs());
  }, []);

  return (
    <main className="p-6">
      <div className="rounded-3xl border border-border bg-bg-elevated px-6 py-10 shadow-card">
        <h1 className="text-3xl text-fg">History</h1>
        {jobs.length === 0 ? (
          <p className="mt-3 text-fg-muted">
            Nothing yet.{" "}
            <Link className="text-accent underline-offset-4 hover:underline" href="/studio/video">
              Generate your first video
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-fg">{job.prompt}</p>
                  <p className="font-mono text-xs text-fg-subtle">
                    {job.modelLabel}, {job.kind}, {job.aspect}, {job.cost} cr
                  </p>
                </div>
                <span className="font-mono text-xs text-accent uppercase">
                  {job.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
