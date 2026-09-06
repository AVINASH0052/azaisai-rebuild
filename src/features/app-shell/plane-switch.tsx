"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PlaneSwitch() {
  const path = usePathname();
  const admin = path.startsWith("/admin");
  return (
    <nav className="flex items-center rounded-full bg-bg-inset p-0.5 text-sm">
      <Link
        href="/studio/video"
        className={
          !admin
            ? "rounded-full bg-bg-elevated px-3 py-1 text-fg shadow-sm"
            : "rounded-full px-3 py-1 text-fg-muted hover:text-fg"
        }
      >
        Studio
      </Link>
      <Link
        href="/admin"
        className={
          admin
            ? "rounded-full bg-bg-elevated px-3 py-1 text-fg shadow-sm"
            : "rounded-full px-3 py-1 text-fg-muted hover:text-fg"
        }
      >
        Admin
      </Link>
    </nav>
  );
}
