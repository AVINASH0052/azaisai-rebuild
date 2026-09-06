import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/features/auth/update-password-form";
import { Wordmark } from "@/features/brand/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function UpdatePasswordPage() {
  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/auth/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-8 shadow-card">
        <Wordmark />
        <h1 className="mt-3 text-3xl text-fg">Set a password</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Choose a password, then sign in with your email and this password.
        </p>
        <div className="mt-8">
          <UpdatePasswordForm />
        </div>
      </div>
    </main>
  );
}
