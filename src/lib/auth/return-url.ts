const ALLOWED = [
  /^\/studio(\/|$)/,
  /^\/history(\/|$)/,
  /^\/credits(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/auth\/mfa(\/|$)/,
  /^\/g\/[A-Za-z0-9_-]+$/,
];

export function parseReturnUrl(value: string | null | undefined) {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  if (decoded.includes("\\") || decoded.includes("://") || decoded.includes("..")) {
    return null;
  }
  if (!ALLOWED.some((re) => re.test(decoded))) return null;
  return decoded;
}

export function safeReturnUrl(value: string | null | undefined) {
  return parseReturnUrl(value) ?? "/studio/video";
}
