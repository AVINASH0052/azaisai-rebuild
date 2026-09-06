"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { TEST_BYPASS_EMAIL, testBypassEnabled } from "@/lib/auth/test-bypass";

const field =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

function digits(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("rate limit")) {
    return "Too many emails just now. Wait a minute and try again.";
  }
  if (m.includes("expired")) {
    return "That code expired. Request a new one.";
  }
  if (m.includes("invalid") || m.includes("otp") || m.includes("token")) {
    return "That code isn't right.";
  }
  return "Something went wrong. Try again.";
}

export function OtpForm({ returnUrl }: { returnUrl: string }) {
  const router = useRouter();
  const dest = safeReturnUrl(returnUrl);
  const verifying = useRef(false);
  const [email, setEmail] = useState(
    testBypassEnabled() ? TEST_BYPASS_EMAIL : "",
  );
  const [code, setCode] = useState("");
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

  async function finish(path: string) {
    router.replace(path);
    router.refresh();
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
      await finish(`/auth/callback?returnUrl=${encodeURIComponent(dest)}`);
    } finally {
      setPending(false);
    }
  }

  async function sendCode() {
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
      setCode("");
      startCooldown();
    } finally {
      setPending(false);
    }
  }

  async function verify(token: string) {
    if (verifying.current || token.length !== 6) return;
    verifying.current = true;
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      await finish(`/auth/callback?returnUrl=${encodeURIComponent(dest)}`);
    } finally {
      verifying.current = false;
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
        if (sent) {
          void verify(code);
          return;
        }
        void sendCode();
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
      {sent ? (
        <label className="block space-y-1.5">
          <span className="text-sm text-fg-muted">6-digit code</span>
          <input
            className={`${field} text-center font-mono text-lg tracking-[0.4em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            autoFocus
            onChange={(e) => {
              const next = digits(e.target.value);
              setCode(next);
              if (next.length === 6) void verify(next);
            }}
          />
        </label>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!sent ? (
        <>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
            {pending ? "Sending…" : "Send code"}
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
        <div className="space-y-3">
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={pending || code.length !== 6}
          >
            {pending ? "Checking…" : "Continue"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-fg-muted underline-offset-4 hover:underline disabled:opacity-50"
              disabled={pending}
              onClick={() => {
                setSent(false);
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
            <button
              type="button"
              className="text-fg-muted underline-offset-4 hover:underline disabled:opacity-50"
              disabled={cooldown > 0 || pending}
              onClick={() => void sendCode()}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
