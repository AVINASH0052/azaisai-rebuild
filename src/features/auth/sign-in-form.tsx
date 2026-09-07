"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  afterEmailLookup,
  authHref,
  friendlyPasswordError,
  normalizeEmail,
} from "@/lib/auth/password-flow";
import { destAfterLogin } from "@/lib/auth/post-login";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { isDemoAdminEmail } from "@/lib/auth/demo-admin";
import { TEST_BYPASS_EMAIL, testBypassEnabled } from "@/lib/auth/test-bypass";
import { createBrowserSupabase, warmBrowserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

const field =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

function isTestEmail(email: string) {
  return (
    testBypassEnabled() &&
    normalizeEmail(email) === TEST_BYPASS_EMAIL
  );
}

export function SignInForm({
  returnUrl,
  initialEmail = "",
}: {
  returnUrl: string;
  initialEmail?: string;
}) {
  const router = useRouter();
  const dest = safeReturnUrl(returnUrl);
  const [step, setStep] = useState<"email" | "password" | "reset">(
    initialEmail.includes("@") && !isTestEmail(initialEmail) ? "password" : "email",
  );
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lookup = useRef<{
    email: string;
    exists: boolean | null;
    inFlight: Promise<boolean | null> | null;
  }>({ email: "", exists: null, inFlight: null });

  function lookupExists(raw: string) {
    const addr = normalizeEmail(raw);
    if (!addr.includes("@")) return Promise.resolve(null);
    const cur = lookup.current;
    if (cur.email === addr && cur.exists !== null) return Promise.resolve(cur.exists);
    if (cur.email === addr && cur.inFlight) return cur.inFlight;
    const inFlight = createBrowserSupabase()
      .rpc("email_registered", { addr })
      .then((res: { data: unknown }) => {
        const exists = typeof res.data === "boolean" ? res.data : null;
        if (lookup.current.email === addr) {
          lookup.current.exists = exists;
          lookup.current.inFlight = null;
        }
        return exists;
      });
    lookup.current = { email: addr, exists: null, inFlight };
    return inFlight;
  }

  useEffect(() => {
    if (!supabaseConfigured()) return;
    warmBrowserSupabase();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured()) return;
    const addr = normalizeEmail(email);
    if (!addr.includes("@")) return;
    const t = window.setTimeout(() => void lookupExists(email), 150);
    return () => window.clearTimeout(t);
  }, [email]);

  const signupHref = authHref("/auth/signup", {
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

  async function bypass() {
    const res = await fetch("/api/auth/test-bypass", { method: "POST" });
    const json = (await res.json()) as { error?: string; ok?: boolean };
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Something went wrong. Try again.");
      return;
    }
    router.replace(`/auth/callback?returnUrl=${encodeURIComponent(dest)}`);
    router.refresh();
  }

  async function continueWithEmail() {
    setPending(true);
    setError(null);
    try {
      if (isTestEmail(email) || isDemoAdminEmail(email)) {
        if (isTestEmail(email)) {
          await bypass();
          return;
        }
        setStep("password");
        return;
      }
      const exists = await lookupExists(email);
      if (afterEmailLookup(exists) === "signup") {
        router.push(signupHref);
        return;
      }
      setStep("password");
    } finally {
      setPending(false);
    }
  }

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const addr = normalizeEmail(email);
      const supabase = createBrowserSupabase();
      let { error: err } = await supabase.auth.signInWithPassword({
        email: addr,
        password,
      });
      if (err && isDemoAdminEmail(addr)) {
        const primed = await fetch("/api/auth/admin-login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: addr, password }),
        });
        const primedJson = (await primed.json()) as { error?: string };
        if (!primed.ok) {
          setError(primedJson.error ?? "Wrong email or password.");
          return;
        }
        ({ error: err } = await supabase.auth.signInWithPassword({
          email: addr,
          password,
        }));
      }
      if (err) {
        setError(friendlyPasswordError(err.message, err.code));
        return;
      }
      router.replace(
        destAfterLogin({
          returnUrl: dest,
          admin: isDemoAdminEmail(addr)
            ? { role: "superadmin", demoReadonly: true }
            : null,
          aal: "aal1",
          signedIn: true,
        }),
      );
    } finally {
      setPending(false);
    }
  }

  async function sendReset() {
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        normalizeEmail(email),
        { redirectTo: `${window.location.origin}/auth/callback?reset=1` },
      );
      if (err) {
        setError(friendlyPasswordError(err.message, err.code));
        return;
      }
      setStep("reset");
    } finally {
      setPending(false);
    }
  }

  if (step === "reset") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">
          Check your email for a link to set a password. Then sign in with that
          password.
        </p>
        <button
          type="button"
          className="text-sm text-fg-muted underline-offset-4 hover:underline"
          onClick={() => {
            setStep("password");
            setError(null);
          }}
        >
          Back to password
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "email") void continueWithEmail();
        else void signIn();
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
          disabled={step === "password" || pending}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {step === "password" ? (
        <label className="block space-y-1.5">
          <span className="text-sm text-fg-muted">Password</span>
          <input
            className={field}
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            disabled={pending}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? "Working…" : step === "email" ? "Continue" : "Sign in"}
      </Button>
      {step === "password" ? (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-fg-muted underline-offset-4 hover:underline"
            disabled={pending}
            onClick={() => {
              setStep("email");
              setPassword("");
              setError(null);
            }}
          >
            Use a different email
          </button>
          <button
            type="button"
            className="text-fg-muted underline-offset-4 hover:underline"
            disabled={pending}
            onClick={() => void sendReset()}
          >
            Forgot password
          </button>
        </div>
      ) : null}
      <p className="text-center text-sm text-fg-muted">
        New here?{" "}
        <Link href={signupHref} className="text-fg underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
