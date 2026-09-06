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
    return "Too many emails just now. Wait a minute and try again.";
  }
  if (m.includes("expired")) {
    return "That link expired. Request a new one.";
  }
  if (m.includes("invalid") || m.includes("otp") || m.includes("token")) {
    return "That sign-in link is not valid.";
  }
  return "Something went wrong. Try again.";
}

function isTestEmail(email: string) {
  return (
    testBypassEnabled() && email.trim().toLowerCase() === TEST_BYPASS_EMAIL
  );
}

export function OtpForm({ returnUrl }: { returnUrl: string }) {
  const router = useRouter();
  const dest = safeReturnUrl(returnUrl);
  const [email, setEmail] = useState("");
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

  function startCooldown() {
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
  }

  async function bypass() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/test-bypass", { method: "POST" });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Something went wrong. Try again.");
        return;
      }
      router.replace(`/auth/callback?returnUrl=${encodeURIComponent(dest)}`);
      router.refresh();
    } finally {
      setPending(false);
    }
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
      startCooldown();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (isTestEmail(email)) {
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
          disabled={sent}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {sent ? (
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">
            Check your email for a sign-in link. Click it to confirm and enter
            the studio.
          </p>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-fg-muted underline-offset-4 hover:underline disabled:opacity-50"
              disabled={pending}
              onClick={() => {
                setSent(false);
                setError(null);
              }}
            >
              Use a different email
            </button>
            <button
              type="button"
              className="text-fg-muted underline-offset-4 hover:underline disabled:opacity-50"
              disabled={cooldown > 0 || pending}
              onClick={() => void sendLink()}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
            </button>
          </div>
        </div>
      ) : (
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "Working…" : "Continue"}
        </Button>
      )}
    </form>
  );
}
