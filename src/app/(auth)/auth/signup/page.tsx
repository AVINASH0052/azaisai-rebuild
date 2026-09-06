import { SignUpForm } from "@/features/auth/sign-up-form";
import { Wordmark } from "@/features/brand/wordmark";
import { safeReturnUrl } from "@/lib/auth/return-url";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string; email?: string }>;
}) {
  const { returnUrl, email } = await searchParams;
  const dest = safeReturnUrl(returnUrl);
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-8 shadow-card">
        <Wordmark />
        <div className="mt-3">
          <SignUpForm returnUrl={dest} initialEmail={email ?? ""} />
        </div>
      </div>
    </main>
  );
}
