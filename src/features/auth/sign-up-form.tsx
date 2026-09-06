"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  authHref,
  friendlyPasswordError,
  MIN_PASSWORD,
  normalizeEmail,
  passwordReady,
  signupAfterResponse,
} from "@/lib/auth/password-flow";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

const field =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

export function SignUpForm({
  returnUrl,
  initialEmail = "",
}: {
  returnUrl: string;
  initialEmail?: string;
}) {
  const dest = safeReturnUrl(returnUrl);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<"form" | "sent" | "ready">("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const loginHref = authHref("/auth/login", {
    email: normalizeEmail(email),
    returnUrl: dest,
  });

  if (!supabaseConfigured()) {
    return (
      <p className="text-sm text-fg-muted">
        Auth is not configured yet. Set{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
      </p>
    );
  }

  async function sendConfirmation() {
    const supabase = createBrowserSupabase();
    return supabase.auth.resend({
      type: "signup",
      email: normalizeEmail(email),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?confirmed=1`,
      },
    });
  }

  async function signUp() {
    if (inFlight.current) return;
    const mismatch = passwordReady(password, confirm);
    if (mismatch) {
      setError(mismatch);
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { data, error: err } = await supabase.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?confirmed=1`,
        },
      });
      const next = signupAfterResponse({
        message: err?.message,
        code: err?.code,
        identities: data.user?.identities,
        hasSession: Boolean(data.session),
      });
      if (next === "wait" || next === "error") {
        setError(friendlyPasswordError(err?.message ?? "", err?.code));
        return;
      }
      if (next === "exists") {
        setError("That email already has an account. Sign in instead.");
        return;
      }
      if (data.session) await supabase.auth.signOut();
      setMode(next === "ready" ? "ready" : "sent");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function resend() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const { error: err } = await sendConfirmation();
      if (err) setError(friendlyPasswordError(err.message, err.code));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (mode === "sent") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl text-fg">Confirmation sent</h1>
        <p className="text-sm text-fg-muted">
          We sent a confirmation link to {normalizeEmail(email)}. Open it, then
          sign in with your password.
        </p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="button"
          className="text-sm text-fg-muted underline-offset-4 hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={() => void resend()}
        >
          {pending ? "Sending…" : "Resend confirmation"}
        </button>
        <Link
          href={loginHref}
          className="block text-center text-sm text-fg underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (mode === "ready") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl text-fg">Account created</h1>
        <p className="text-sm text-fg-muted">
          Sign in with your email and password.
        </p>
        <Link
          href={loginHref}
          className="block text-center text-sm text-fg underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl text-fg">Create an account</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Enter your email and a new password. We will send a confirmation link.
        After you confirm, sign in with that password.
      </p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signUp();
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
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
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
          {pending ? "Working…" : "Create account"}
        </Button>
        <p className="text-center text-sm text-fg-muted">
          Already have an account?{" "}
          <Link href={loginHref} className="text-fg underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
