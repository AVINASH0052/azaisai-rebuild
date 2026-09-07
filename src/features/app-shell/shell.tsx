import Link from "next/link";
import { sessionBalance } from "@/services/credits";
import { CreditChip } from "@/features/studio/credit-chip";
import { Wordmark } from "@/features/brand/wordmark";
import { AdminPlaneSwitch } from "./admin-plane-switch";
import { ModeSwitch } from "./mode-switch";
import { NavLinks } from "./nav-links";
import { LocalOwnerSync } from "./local-owner-sync";
import { SignOutButton } from "./sign-out-button";

const NAV = [
  { href: "/studio/video", label: "Studio" },
  { href: "/history", label: "History" },
  { href: "/credits", label: "Credits" },
  { href: "/settings", label: "Settings" },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { balance, owner } = await sessionBalance();
  return (
    <LocalOwnerSync owner={owner}>
      <div className="min-h-screen text-fg">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-bg-elevated/80 px-4 py-3 backdrop-blur-md">
          <Link href="/studio/video" className="leading-none">
            <Wordmark className="text-[1.25rem]" />
          </Link>
          <ModeSwitch />
          <AdminPlaneSwitch />
          <div className="ml-auto flex items-center gap-4">
            <CreditChip fallback={balance} />
            <SignOutButton />
          </div>
        </header>
        <div className="flex">
          <aside className="hidden min-h-[calc(100vh-57px)] w-52 shrink-0 border-r border-border bg-sidebar/80 p-3 md:block">
            <NavLinks items={NAV} />
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </LocalOwnerSync>
  );
}
