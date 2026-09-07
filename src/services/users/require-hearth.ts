import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { isUserBanned } from "./app-users";

export async function assertCanUseHearth(supabase: SupabaseClient | null) {
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to use Hearth.");
  if (await isUserBanned(supabase, user)) {
    throw new AppError("ACCOUNT_SUSPENDED", "This Hearth account is banned.");
  }
}
