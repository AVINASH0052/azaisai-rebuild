/** ponytail: temp mailer bypass. Delete this file, /api/auth/test-bypass, the form button, and cookie checks in middleware. */

export const TEST_BYPASS_EMAIL = "dev@azaisai.test";
export const TEST_BYPASS_COOKIE = "azai_test_bypass";

export function isAuthCookieName(name: string) {
  return name === TEST_BYPASS_COOKIE || name.startsWith("sb-");
}

export function expireAuthCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
/** Enough for several 6s Veo Fast clips (9 cr each: 6s × 1.5). */
export const TEST_BYPASS_CREDITS = 80;

export function testBypassEnabled() {
  return process.env.NEXT_PUBLIC_AUTH_TEST_BYPASS === "1";
}

export function testBypassSecret() {
  return process.env.AUTH_TEST_PASSWORD;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(secret: string, msg: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signBypassCookie(secret: string) {
  return hmacHex(secret, TEST_BYPASS_EMAIL);
}

export async function isValidBypassCookie(
  value: string | undefined,
  secret: string | undefined,
) {
  if (!testBypassEnabled() || !value || !secret) return false;
  return safeEqual(value, await signBypassCookie(secret));
}
