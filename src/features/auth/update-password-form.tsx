"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  friendlyPasswordError,
  MIN_PASSWORD,
  passwordReady,
} from "@/lib/auth/password-flow";
import { createBrowserSupabase } from "@/lib/supabase/client";

const field =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const mismatch = passwordReady(password, confirm);
        if (mismatch) {
          setError(mismatch);
          return;
        }
        setPending(true);
        setError(null);
        void (async () => {
          try {
            const supabase = createBrowserSupabase();
            const { error: err } = await supabase.auth.updateUser({ password });
            if (err) {
              setError(friendlyPasswordError(err.message));
              return;
            }
            router.replace("/auth/callback");
            router.refresh();
          } finally {
            setPending(false);
          }
        })();
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm text-fg-muted">New password</span>
        <input
          className={field}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          disabled={pending}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-fg-muted">Confirm password</span>
        <input
          className={field}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={confirm}
          disabled={pending}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? "Working…" : "Save password"}
      </Button>
    </form>
  );
}
