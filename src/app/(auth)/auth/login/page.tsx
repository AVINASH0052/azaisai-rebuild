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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
        AzaisAI
      </p>
      <h1 className="mt-3 text-2xl text-fg">Sign in</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Email a 6-digit code. No password.
      </p>
      <div className="mt-8">
        <OtpForm mode="login" returnUrl={dest} />
      </div>
      <p className="mt-6 text-sm text-fg-subtle">
        New here?{" "}
        <Link className="text-fg-muted underline-offset-4 hover:underline" href={`/auth/signup?returnUrl=${encodeURIComponent(dest)}`}>
          Create an account
        </Link>
      </p>
    </main>
  );
}
