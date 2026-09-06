import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformAdmin = {
  role: "support" | "operator" | "superadmin";
  demoReadonly: boolean;
};

export async function getPlatformAdmin(
  supabase: SupabaseClient | null,
  userId: string | undefined,
): Promise<PlatformAdmin | null> {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("platform_admins")
    .select("role, revoked_at, demo_readonly")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  return {
    role: data.role as PlatformAdmin["role"],
    demoReadonly: Boolean(data.demo_readonly),
  };
}

export async function isPlatformAdmin(
  supabase: SupabaseClient | null,
  userId: string | undefined,
) {
  return Boolean(await getPlatformAdmin(supabase, userId));
}

export async function currentAal(supabase: SupabaseClient) {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel ?? "aal1";
  } catch {
    return "aal1";
  }
}
