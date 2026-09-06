"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ModeSwitch() {
  const path = usePathname();
  const video = path.startsWith("/studio/video");
  const image = path.startsWith("/studio/image");
  return (
    <nav className="flex items-center rounded-full bg-bg-inset p-0.5 text-sm">
      <Link
        href="/studio/video"
        className={
          video
            ? "rounded-full bg-bg-elevated px-3 py-1 text-fg shadow-sm"
            : "rounded-full px-3 py-1 text-fg-muted hover:text-fg"
        }
      >
        Video
      </Link>
      <Link
        href="/studio/image"
        className={
          image
            ? "rounded-full bg-bg-elevated px-3 py-1 text-fg shadow-sm"
            : "rounded-full px-3 py-1 text-fg-muted hover:text-fg"
        }
      >
        Image
      </Link>
    </nav>
  );
}
