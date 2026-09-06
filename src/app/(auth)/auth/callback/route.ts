import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { postLoginPath } from "@/lib/auth/post-login";
import { authHref, callbackAfterExchange } from "@/lib/auth/password-flow";
import { safeReturnUrl } from "@/lib/auth/return-url";
import {
  expireAuthCookie,
  isAuthCookieName,
} from "@/lib/auth/test-bypass";
import { createServerSupabase } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function loginUrl(origin: string, returnUrl: string | null, confirmed = false, email?: string) {
  const dest = safeReturnUrl(returnUrl);
  return new URL(
    authHref("/auth/login", { returnUrl: dest, confirmed, email }),
    origin,
  );
}

async function forgetSession(res: NextResponse) {
  const jar = await cookies();
  const clear = expireAuthCookie();
  for (const cookie of jar.getAll()) {
    if (isAuthCookieName(cookie.name)) res.cookies.set(cookie.name, "", clear);
  }
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const type = typeParam && OTP_TYPES.has(typeParam as EmailOtpType)
    ? (typeParam as EmailOtpType)
    : null;
  const supabase = await createServerSupabase();

  if (supabase) {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(loginUrl(url.origin, url.searchParams.get("returnUrl")));
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) {
        return NextResponse.redirect(loginUrl(url.origin, url.searchParams.get("returnUrl")));
      }
    }
  }

  const after = callbackAfterExchange({
    confirmed: url.searchParams.get("confirmed"),
    reset: url.searchParams.get("reset"),
    type,
  });

  if (after === "confirm") {
    const email = supabase
      ? (await supabase.auth.getUser()).data.user?.email ?? undefined
      : undefined;
    if (supabase) await supabase.auth.signOut();
    return forgetSession(
      NextResponse.redirect(loginUrl(url.origin, url.searchParams.get("returnUrl"), true, email)),
    );
  }

  if (after === "reset") {
    return NextResponse.redirect(new URL("/auth/update-password", url.origin));
  }

  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const dest = await postLoginPath(supabase, user, url.searchParams.get("returnUrl"));
  return NextResponse.redirect(new URL(dest, url.origin));
}
