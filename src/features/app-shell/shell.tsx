import Link from "next/link";
import { sessionBalance } from "@/services/credits";
import { ModeSwitch } from "./mode-switch";
import { SignOutButton } from "./sign-out-button";

const NAV = [
  { href: "/studio/video", label: "Studio" },
  { href: "/history", label: "History" },
  { href: "/credits", label: "Credits" },
  { href: "/settings", label: "Settings" },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { balance } = await sessionBalance();
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="flex items-center gap-4 border-b border-border px-4 py-3">
        <Link
          href="/studio/video"
          className="font-mono text-xs tracking-[0.18em] text-accent uppercase"
        >
          AzaisAI
        </Link>
        <ModeSwitch />
        <div className="ml-auto flex items-center gap-4">
          <span
            className="rounded-full border border-border bg-bg-elevated px-3 py-1 font-mono text-sm"
            aria-label={`${balance} credits`}
          >
            {balance} cr
          </span>
          <SignOutButton />
        </div>
      </header>
      <div className="flex">
        <aside className="hidden w-52 shrink-0 border-r border-border p-3 md:block">
          <nav className="flex flex-col gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-fg-muted hover:bg-bg-elevated hover:text-fg"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
