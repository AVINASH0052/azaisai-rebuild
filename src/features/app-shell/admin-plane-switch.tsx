import { currentAal, getPlatformAdmin } from "@/lib/auth/platform-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { PlaneSwitch } from "./plane-switch";

export async function AdminPlaneSwitch() {
  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const admin = await getPlatformAdmin(supabase, user?.id, user);
  if (!admin || !supabase) return null;
  if (!admin.demoReadonly && (await currentAal(supabase)) !== "aal2") return null;
  return <PlaneSwitch />;
}
