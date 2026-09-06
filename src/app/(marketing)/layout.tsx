import type { ReactNode } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/features/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link href="/" aria-label={BRAND}>
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-fg-muted sm:flex">
            <a href="#models" className="hover:text-fg">
              Models
            </a>
            <a href="#how" className="hover:text-fg">
              How it works
            </a>
            <a href="#pricing" className="hover:text-fg">
              Pricing
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 px-3">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="h-8 px-3">
              <Link href="/auth/login">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-fg-subtle">
          <Wordmark className="text-lg text-fg-muted" />
          <p className="font-mono text-xs">
            {env.PROVIDER_MODE} · {env.NEXT_PUBLIC_GIT_SHA.slice(0, 7)}
          </p>
        </div>
      </footer>
    </div>
  );
}
