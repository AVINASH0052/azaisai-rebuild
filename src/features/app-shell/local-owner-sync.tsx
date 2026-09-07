"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { setLocalOwner } from "@/features/studio/local-owner";

export function LocalOwnerSync({
  owner,
  children,
}: {
  owner: string | null;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    setLocalOwner(owner);
  }, [owner]);
  return children;
}
