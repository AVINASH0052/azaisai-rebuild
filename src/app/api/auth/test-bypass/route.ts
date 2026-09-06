import { NextResponse } from "next/server";
import {
  TEST_BYPASS_COOKIE,
  signBypassCookie,
  testBypassEnabled,
  testBypassSecret,
} from "@/lib/auth/test-bypass";

// ponytail: delete this route when the mailer works. Ceiling: anyone who can POST here gets a studio cookie.

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function POST() {
  if (!testBypassEnabled()) {
    return NextResponse.json({ error: "Bypass is off." }, { status: 404 });
  }
  const secret = testBypassSecret();
  if (!secret || secret.length < 8) {
    return NextResponse.json({ error: "Test login is not configured." }, { status: 503 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEST_BYPASS_COOKIE, await signBypassCookie(secret), {
    ...cookieOpts,
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEST_BYPASS_COOKIE, "", { ...cookieOpts, maxAge: 0 });
  return res;
}
