import { BRAND } from "@/lib/brand";
import { cn } from "cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-heading text-[1.4rem] leading-none text-fg", className)}>
      {BRAND}
    </span>
  );
}
