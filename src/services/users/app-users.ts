import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isDemoAdminEmail } from "@/lib/auth/demo-admin";
import { creditsFromMeta } from "@/services/credits/meter";

export type ServiceUser = {
  id: string;
  email: string;
  credits: number;
  createdAt: string | null;
  admin: boolean;
};

export async function touchAppUser(supabase: SupabaseClient, user: User) {
  const credits = creditsFromMeta(user.user_metadata);
  await supabase.from("app_users").upsert(
    {
      user_id: user.id,
      email: user.email ?? "",
      credits,
    },
    { onConflict: "user_id" },
  );
}

export async function creditsFromAppUser(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("app_users")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || data?.credits == null) return null;
  const n = Number(data.credits);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export async function writeAppUserCredits(
  supabase: SupabaseClient,
  userId: string,
  credits: number,
) {
  await supabase
    .from("app_users")
    .update({ credits, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export function userFromAuth(user: User): ServiceUser {
  return {
    id: user.id,
    email: user.email ?? "",
    credits: creditsFromMeta(user.user_metadata),
    createdAt: user.created_at ?? null,
    admin: isDemoAdminEmail(user.email),
  };
}
