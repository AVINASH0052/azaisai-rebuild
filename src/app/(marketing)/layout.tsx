import type { ReactNode } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/features/brand/wordmark";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="film-lab min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#3a3226]/80 bg-[#16130e]/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link href="/" aria-label={BRAND}>
            <Wordmark className="text-[#f6edd8]" />
          </Link>
          <nav className="hidden items-center gap-5 font-mono text-[11px] tracking-[0.18em] text-[#c9bba0] uppercase sm:flex">
            <a href="#gate" className="hover:text-[#f6edd8]">
              Gate
            </a>
            <a href="#models" className="hover:text-[#f6edd8]">
              Bench
            </a>
          </nav>
          <div className="ml-auto">
            <Link
              href="/auth/login"
              className="rounded-full bg-[#f3ead2] px-3 py-1.5 text-sm text-[#1d1b16] hover:bg-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-[#3a3226]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <Wordmark className="text-lg text-[#8f846c]" />
          <p className="font-mono text-[11px] text-[#8f846c]">
            {env.PROVIDER_MODE} · {env.NEXT_PUBLIC_GIT_SHA.slice(0, 7)}
          </p>
        </div>
      </footer>
    </div>
  );
}
