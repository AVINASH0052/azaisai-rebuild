import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnUrl } from "@/lib/auth/return-url";

const PROTECTED = ["/studio", "/history", "/credits", "/settings", "/admin"];

function isProtected(pathname: string) {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (isProtected(pathname)) {
      const login = request.nextUrl.clone();
      login.pathname = "/auth/login";
      login.search = `?returnUrl=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(login);
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/auth/login";
    login.search = `?returnUrl=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(login);
  }

  if (user && pathname.startsWith("/auth/") && pathname !== "/auth/callback") {
    const dest = safeReturnUrl(request.nextUrl.searchParams.get("returnUrl"));
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/studio/:path*",
    "/history/:path*",
    "/credits/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/auth/:path*",
  ],
};
