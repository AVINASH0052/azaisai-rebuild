import Link from "next/link";
import { OtpForm } from "@/features/auth/otp-form";
import { safeReturnUrl } from "@/lib/auth/return-url";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const { returnUrl } = await searchParams;
  const dest = safeReturnUrl(returnUrl);
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-8 shadow-card">
        <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
          AzaisAI
        </p>
        <h1 className="mt-3 text-3xl text-fg">Sign in</h1>
        <p className="mt-2 text-sm text-fg-muted">
          We&apos;ll email you a sign-in link. No password.
        </p>
        <div className="mt-8">
          <OtpForm mode="login" returnUrl={dest} />
        </div>
        <p className="mt-6 text-sm text-fg-subtle">
          New here?{" "}
          <Link
            className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
            href={`/auth/signup?returnUrl=${encodeURIComponent(dest)}`}
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
