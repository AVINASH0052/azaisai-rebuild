import { BRAND } from "@/lib/brand";
import { cn } from "cn";
import { HearthMark } from "./mark";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-heading text-[1.4rem] leading-none text-fg",
        className,
      )}
    >
      <HearthMark className="size-[1.15em] shrink-0" />
      {BRAND}
    </span>
  );
}
