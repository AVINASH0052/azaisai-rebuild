"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { afterMfaPath } from "@/lib/auth/post-login";
import { createBrowserSupabase } from "@/lib/supabase/client";

const field =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

function digits(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function MfaForm({ returnUrl }: { returnUrl: string }) {
  const router = useRouter();
  const dest = afterMfaPath(returnUrl);
  const verifying = useRef(false);
  const [mode, setMode] = useState<"loading" | "enroll" | "challenge">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const supabase = createBrowserSupabase();
        const { data: listed, error: listErr } = await supabase.auth.mfa.listFactors();
        if (cancelled) return;
        if (listErr) {
          setError(listErr.message);
          setMode("challenge");
          return;
        }
        const verified = listed.totp.find((f: { status: string }) => f.status === "verified");
        if (verified) {
          setFactorId(verified.id);
          setMode("challenge");
          return;
        }
        for (const f of listed.totp) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Hearth",
        });
        if (cancelled) return;
        if (enrollErr || !data) {
          setError(
            enrollErr?.message ??
              "Authenticator setup is unavailable. Enable MFA in the Supabase dashboard.",
          );
          setMode("challenge");
          return;
        }
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
        setMode("enroll");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
        setMode("challenge");
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify(token: string) {
    if (verifying.current || !factorId || token.length !== 6) return;
    verifying.current = true;
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: token,
      });
      if (err) {
        setError("That code isn't right.");
        return;
      }
      router.replace(dest);
      router.refresh();
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
        void verify(code);
      }}
    >
      {mode === "loading" ? (
        <p className="text-sm text-fg-muted">Preparing authenticator…</p>
      ) : null}
      {mode === "enroll" && qr ? (
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">
            Scan this with your authenticator app, then enter the 6-digit code.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="Authenticator QR code"
            className="mx-auto h-44 w-44 rounded-xl border border-border bg-white p-2"
          />
          {secret ? (
            <p className="break-all text-center font-mono text-xs text-fg-subtle">
              {secret}
            </p>
          ) : null}
        </div>
      ) : null}
      {mode === "challenge" && !factorId && !error ? (
        <p className="text-sm text-fg-muted">Enter the 6-digit authenticator code.</p>
      ) : null}
      {mode !== "loading" ? (
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
      {mode !== "loading" ? (
        <Button
          type="submit"
          size="lg"
          className="h-11 w-full"
          disabled={pending || !factorId || code.length !== 6}
        >
          {pending ? "Checking…" : "Continue"}
        </Button>
      ) : null}
    </form>
  );
}
