import type { ReactNode } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/features/brand/wordmark";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="film-lab min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--lab-line)]/70 bg-[var(--lab)]/75 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link href="/" aria-label={BRAND}>
            <Wordmark className="text-[var(--lab-ink)]" />
          </Link>
          <nav className="hidden items-center gap-5 font-mono text-[11px] tracking-[0.18em] text-[var(--lab-muted)] uppercase sm:flex">
            <a href="#gate" className="hover:text-[var(--lab-ink)]">
              Gate
            </a>
            <a href="#models" className="hover:text-[var(--lab-ink)]">
              Bench
            </a>
          </nav>
          <div className="ml-auto">
            <Link
              href="/auth/login"
              className="rounded-full bg-[var(--lab-cream)] px-3 py-1.5 text-sm text-[var(--lab-deep)] hover:bg-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-[var(--lab-line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <Wordmark className="text-lg text-[var(--lab-dim)]" />
          <p className="font-mono text-[11px] text-[var(--lab-dim)]">
            {env.PROVIDER_MODE} {env.NEXT_PUBLIC_GIT_SHA.slice(0, 7)}
          </p>
        </div>
      </footer>
    </div>
  );
}
