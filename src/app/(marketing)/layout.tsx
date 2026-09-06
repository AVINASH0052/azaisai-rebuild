import type { ReactNode } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/features/brand/wordmark";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="film-lab min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link href="/" aria-label={BRAND}>
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-5 font-mono text-[11px] tracking-[0.18em] text-fg-muted uppercase sm:flex">
            <a href="#gate" className="hover:text-fg">
              Gate
            </a>
            <a href="#models" className="hover:text-fg">
              Bench
            </a>
          </nav>
          <div className="ml-auto">
            <Link
              href="/auth/login"
              className="rounded-full bg-ink px-3 py-1.5 text-sm text-bg-elevated hover:bg-fg"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-8">
          <Wordmark className="text-lg text-fg-subtle" />
        </div>
      </footer>
    </div>
  );
}
