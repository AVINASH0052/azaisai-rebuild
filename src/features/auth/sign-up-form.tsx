"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  alreadyRegistered,
  authHref,
  friendlyPasswordError,
  isEmailSendLimit,
  MIN_PASSWORD,
  normalizeEmail,
  passwordReady,
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
  const [sent, setSent] = useState(false);
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

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">
          Confirm your email address. After you click the link, sign in with
          this email and password.
        </p>
        <Link
          href={authHref("/auth/login", {
            email: normalizeEmail(email),
            returnUrl: dest,
          })}
          className="block text-center text-sm text-fg underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
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
      if (err) {
        // First click can fire twice; the second hits Supabase's per-email send cap.
        if (isEmailSendLimit(err.message, err.code)) {
          setSent(true);
          return;
        }
        setError(friendlyPasswordError(err.message, err.code));
        return;
      }
      if (alreadyRegistered(data.user)) {
        setError("That email already has an account. Sign in instead.");
        return;
      }
      if (data.session) {
        await supabase.auth.signOut();
      }
      setSent(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-4"
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
  );
}
