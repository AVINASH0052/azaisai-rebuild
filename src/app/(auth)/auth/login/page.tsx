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
          Enter your email. We&apos;ll send a 6-digit code.
        </p>
        <div className="mt-8">
          <OtpForm returnUrl={dest} />
        </div>
      </div>
    </main>
  );
}
