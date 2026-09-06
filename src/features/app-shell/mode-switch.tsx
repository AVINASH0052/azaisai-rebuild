"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ModeSwitch() {
  const path = usePathname();
  const video = path.startsWith("/studio/video");
  const image = path.startsWith("/studio/image");
  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/studio/video" className={video ? "text-fg" : "text-fg-muted hover:text-fg"}>
        Video
      </Link>
      <span className="text-fg-subtle">·</span>
      <Link href="/studio/image" className={image ? "text-fg" : "text-fg-muted hover:text-fg"}>
        Image
      </Link>
    </nav>
  );
}
