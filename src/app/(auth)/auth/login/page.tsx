import { SignInForm } from "@/features/auth/sign-in-form";
import { Wordmark } from "@/features/brand/wordmark";
import { safeReturnUrl } from "@/lib/auth/return-url";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnUrl?: string;
    confirmed?: string;
    email?: string;
  }>;
}) {
  const { returnUrl, confirmed, email } = await searchParams;
  const dest = safeReturnUrl(returnUrl);
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-8 shadow-card">
        <Wordmark />
        <h1 className="mt-3 text-3xl text-fg">Sign in</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {confirmed === "1"
            ? "Email confirmed. Sign in with your password."
            : "Enter your email. If you have an account, you will enter your password next."}
        </p>
        <div className="mt-8">
          <SignInForm returnUrl={dest} initialEmail={email ?? ""} />
        </div>
      </div>
    </main>
  );
}
