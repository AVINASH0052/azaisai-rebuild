import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  currentAal,
  getPlatformAdmin,
  type PlatformAdmin,
} from "./platform-admin";
import { parseReturnUrl } from "./return-url";

export function destAfterLogin(opts: {
  returnUrl?: string | null;
  admin: PlatformAdmin | null;
  aal: string;
  signedIn: boolean;
}) {
  const explicit = parseReturnUrl(opts.returnUrl);
  const adminReady = Boolean(
    opts.admin && (opts.admin.demoReadonly || opts.aal === "aal2"),
  );
  if (adminReady) {
    if (explicit && explicit.startsWith("/admin")) return explicit;
    return "/admin";
  }
  if (explicit) return explicit;
  if (!opts.signedIn || !opts.admin) return "/studio/video";
  return "/auth/mfa?returnUrl=%2Fadmin";
}

export function afterMfaPath(returnUrl?: string | null) {
  const dest = parseReturnUrl(returnUrl);
  if (!dest || dest.startsWith("/auth/mfa")) return "/admin";
  return dest;
}

export async function postLoginPath(
  supabase: SupabaseClient | null,
  user: User | null,
  returnUrl?: string | null,
) {
  if (!supabase || !user) {
    return destAfterLogin({
      returnUrl,
      admin: null,
      aal: "aal1",
      signedIn: false,
    });
  }
  const admin = await getPlatformAdmin(supabase, user.id, user);
  const aal =
    admin && !admin.demoReadonly ? await currentAal(supabase) : "aal1";
  return destAfterLogin({ returnUrl, admin, aal, signedIn: true });
}
