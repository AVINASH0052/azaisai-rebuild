import Link from "next/link";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
        AzaisAI
      </p>
      <h1 className="mt-5 text-4xl text-fg sm:text-5xl">
        Generate video and images.
        <span className="mt-2 block text-fg-muted">Watch honest progress.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
        Sign in, spend credits, wait for a real state machine, download the
        file. The original loop, rebuilt on a ledger and a job queue.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg" className="h-11 px-5">
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-11 px-5">
          <Link href="/auth/login">Sign up</Link>
        </Button>
      </div>
      <p className="mt-12 font-mono text-xs text-fg-subtle">
        {env.PROVIDER_MODE} · {env.NEXT_PUBLIC_GIT_SHA.slice(0, 7)}
      </p>
    </main>
  );
}
