import { env } from "@/lib/env";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
        AzaisAI
      </p>
      <h1 className="mt-4 text-4xl tracking-tight text-fg sm:text-5xl">
        Generate video and images.
        <span className="block text-fg-muted">Watch honest progress.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
        Sign in with an email code, spend credits, wait for a real state machine,
        download the file. The original loop, rebuilt on a ledger and a job
        queue.
      </p>
      <p className="mt-10 font-mono text-xs text-fg-subtle">
        {env.PROVIDER_MODE} · {env.NEXT_PUBLIC_GIT_SHA.slice(0, 7)}
      </p>
    </main>
  );
}
