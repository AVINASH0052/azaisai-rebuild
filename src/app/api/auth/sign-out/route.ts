import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  TEST_BYPASS_COOKIE,
  expireAuthCookie,
  isAuthCookieName,
} from "@/lib/auth/test-bypass";

export async function POST(req: Request) {
  const jar = await cookies();
  const res = NextResponse.redirect(new URL("/auth/login", req.url), 303);
  const clear = expireAuthCookie();
  res.cookies.set(TEST_BYPASS_COOKIE, "", clear);
  for (const cookie of jar.getAll()) {
    if (isAuthCookieName(cookie.name)) res.cookies.set(cookie.name, "", clear);
  }
  return res;
}
