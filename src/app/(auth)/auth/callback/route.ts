import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeReturnUrl } from "@/lib/auth/return-url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const dest = safeReturnUrl(url.searchParams.get("returnUrl"));
  const supabase = await createServerSupabase();
  if (code && supabase) {
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(dest, url.origin));
}
