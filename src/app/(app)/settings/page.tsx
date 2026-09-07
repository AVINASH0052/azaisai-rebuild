import { StudioSettings } from "@/features/studio/studio-settings";
import { TEST_BYPASS_EMAIL } from "@/lib/auth/test-bypass";
import { createServerSupabase, hasTestBypass } from "@/lib/supabase/server";

async function account() {
  if (await hasTestBypass()) {
    return { email: TEST_BYPASS_EMAIL, name: "Test user", joined: null as string | null };
  }
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const email = user.email ?? "";
  return {
    email,
    name:
      (profile?.display_name as string | null | undefined)?.trim() ||
      email.split("@")[0] ||
      "Member",
    joined: user.created_at ?? null,
  };
}

function joinedLabel(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SettingsPage() {
  const me = await account();
  return (
    <main className="p-6">
      <div className="rounded-3xl border border-border bg-bg-elevated px-6 py-10 shadow-card">
        <h1 className="text-3xl text-fg">Settings</h1>
        {me ? (
          <dl className="mt-6">
            <div className="flex justify-between gap-4 border-b border-border py-3">
              <dt className="text-sm text-fg-muted">Name</dt>
              <dd className="text-sm text-fg">{me.name}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border py-3">
              <dt className="text-sm text-fg-muted">Email</dt>
              <dd className="text-sm text-fg">{me.email}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-sm text-fg-muted">Joined</dt>
              <dd className="text-sm text-fg">{joinedLabel(me.joined)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-fg-muted">Sign in to see your account.</p>
        )}
      </div>
      <div className="mt-6 rounded-3xl border border-border bg-bg-elevated px-6 py-10 shadow-card">
        <h1 className="text-3xl text-fg">Generation</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Choose the image and video defaults Studio should open with.
        </p>
        <StudioSettings />
      </div>
    </main>
  );
}
