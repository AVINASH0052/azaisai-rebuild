"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-fg-subtle hover:text-fg"
      onClick={async () => {
        await fetch("/api/auth/test-bypass", { method: "DELETE" });
        const supabase = createBrowserSupabase();
        await supabase.auth.signOut();
        router.replace("/auth/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
