import { redirect } from "next/navigation";
import { MfaForm } from "@/features/auth/mfa-form";
import { Wordmark } from "@/features/brand/wordmark";
import { currentAal, getPlatformAdmin } from "@/lib/auth/platform-admin";
import { afterMfaPath } from "@/lib/auth/post-login";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const { returnUrl } = await searchParams;
  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) {
    redirect(`/auth/login?returnUrl=${encodeURIComponent("/auth/mfa")}`);
  }
  const admin = await getPlatformAdmin(supabase, user.id);
  if (!admin) redirect("/studio/video");
  if (admin.demoReadonly) redirect("/admin");
  if ((await currentAal(supabase)) === "aal2") redirect(afterMfaPath(returnUrl));

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-8 shadow-card">
        <Wordmark />
        <h1 className="mt-3 text-3xl text-fg">Authenticator</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Admin access needs a 6-digit authenticator code for this session.
        </p>
        <div className="mt-8">
          <MfaForm returnUrl={returnUrl ?? "/admin"} />
        </div>
      </div>
    </main>
  );
}
