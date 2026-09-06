import type { SupabaseClient } from "@supabase/supabase-js";

export async function isPlatformAdmin(
  supabase: SupabaseClient | null,
  userId: string | undefined,
) {
  if (!supabase || !userId) return false;
  const { data, error } = await supabase
    .from("platform_admins")
    .select("revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.revoked_at == null;
}
