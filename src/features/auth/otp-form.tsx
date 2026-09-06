"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import { safeReturnUrl } from "@/lib/auth/return-url";

const field =
  "w-full rounded-xl border border-border bg-bg-inset px-3 py-2 text-fg outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

export function OtpForm({
  mode,
  returnUrl,
}: {
  mode: "login" | "signup";
  returnUrl: string;
}) {
  const router = useRouter();
  const dest = safeReturnUrl(returnUrl);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  if (!supabaseConfigured()) {
    return (
      <p className="text-sm text-fg-muted">
        Auth is not configured yet. Set{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
      </p>
    );
  }

  async function sendCode() {
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (err) {
        setError(err.message);
        return;
      }
      setStep("code");
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

  async function verify() {
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: code.replace(/\s/g, ""),
        type: "email",
      });
      if (err) {
        setError(
          err.message.toLowerCase().includes("expired")
            ? "That code expired — request a new one."
            : err.message,
        );
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
        if (step === "email") void sendCode();
        else void verify();
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
          disabled={step === "code"}
        />
      </label>
      {step === "code" ? (
        <label className="block space-y-1.5">
          <span className="text-sm text-fg-muted">6-digit code</span>
          <input
            className={`${field} font-mono tracking-[0.3em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            required
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
            }
            onPaste={(e) => {
              const text = e.clipboardData.getData("text").replace(/[^\d]/g, "");
              if (text) {
                e.preventDefault();
                setCode(text.slice(0, 6));
              }
            }}
          />
        </label>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {step === "email"
          ? pending
            ? "Sending…"
            : mode === "signup"
              ? "Send code"
              : "Continue"
          : pending
            ? "Checking…"
            : "Enter studio"}
      </Button>
      {step === "code" ? (
        <button
          type="button"
          className="text-sm text-fg-muted underline-offset-4 hover:underline disabled:opacity-50"
          disabled={cooldown > 0 || pending}
          onClick={() => void sendCode()}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      ) : null}
    </form>
  );
}
