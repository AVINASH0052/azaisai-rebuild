"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1 text-sm">
      {items.map((item) => {
        const studio = item.href.startsWith("/studio");
        const active = studio
          ? path.startsWith("/studio")
          : path === item.href || path.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-xl bg-bg-elevated px-3 py-2 font-medium text-fg shadow-sm"
                : "rounded-xl px-3 py-2 text-fg-muted hover:bg-bg-elevated/70 hover:text-fg"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
