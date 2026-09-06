import { NextResponse } from "next/server";
import { postLoginPath } from "@/lib/auth/post-login";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await createServerSupabase();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const dest = safeReturnUrl(url.searchParams.get("returnUrl"));
      return NextResponse.redirect(
        new URL(`/auth/login?returnUrl=${encodeURIComponent(dest)}`, url.origin),
      );
    }
  }

  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const dest = await postLoginPath(supabase, user, url.searchParams.get("returnUrl"));
  return NextResponse.redirect(new URL(dest, url.origin));
}
