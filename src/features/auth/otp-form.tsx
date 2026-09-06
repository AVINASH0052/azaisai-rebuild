"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { TEST_BYPASS_EMAIL, testBypassEnabled } from "@/lib/auth/test-bypass";

const field =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("rate limit")) {
    return "Free Supabase mail allows 2 emails per hour. Wait an hour, or open a link already in your inbox.";
  }
  return message;
}

export function OtpForm({
  mode,
  returnUrl,
}: {
  mode: "login" | "signup";
  returnUrl: string;
}) {
  const router = useRouter();
  const dest = safeReturnUrl(returnUrl);
  const [email, setEmail] = useState(
    testBypassEnabled() ? TEST_BYPASS_EMAIL : "",
  );
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  if (!supabaseConfigured()) {
    return (
      <p className="text-sm text-fg-muted">
        Auth is not configured yet. Set{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
      </p>
    );
  }

  async function sendLink() {
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const redirectTo = `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(dest)}`;
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
        },
      });
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      setSent(true);
      setCooldown(30);
      const t = setInterval(() => {
        setCooldown((s) => {
          if (s <= 1) {
            clearInterval(t);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } finally {
      setPending(false);
    }
  }

  async function bypass() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/test-bypass", { method: "POST" });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Test login failed.");
        return;
      }
      router.replace(dest);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (
          testBypassEnabled() &&
          email.trim().toLowerCase() === TEST_BYPASS_EMAIL
        ) {
          void bypass();
          return;
        }
        void sendLink();
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm text-fg-muted">Email</span>
        <input
          className={field}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {sent ? (
        <p className="text-sm text-fg-muted">
          Check {email} for a sign-in link. It expires in an hour and can only be
          used once.
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!sent ? (
        <>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
            {pending
              ? "Sending…"
              : mode === "signup"
                ? "Send link"
                : "Continue"}
          </Button>
          {testBypassEnabled() ? (
            <button
              type="button"
              className="w-full text-sm text-fg-muted underline-offset-4 hover:underline disabled:opacity-50"
              disabled={pending}
              onClick={() => void bypass()}
            >
              Continue as test user
            </button>
          ) : null}
        </>
      ) : (
        <button
          type="submit"
          className="text-sm text-fg-muted underline-offset-4 hover:underline disabled:opacity-50"
          disabled={cooldown > 0 || pending}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
        </button>
      )}
    </form>
  );
}
