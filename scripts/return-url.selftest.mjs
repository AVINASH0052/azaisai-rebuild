import assert from "node:assert/strict";

const ALLOWED = [
  /^\/studio(\/|$)/,
  /^\/history(\/|$)/,
  /^\/credits(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/g\/[A-Za-z0-9_-]+$/,
];

function parseReturnUrl(value) {
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

function safeReturnUrl(value) {
  return parseReturnUrl(value) ?? "/studio/video";
}

assert.equal(safeReturnUrl(null), "/studio/video");
assert.equal(safeReturnUrl("/studio/image"), "/studio/image");
assert.equal(safeReturnUrl("/admin"), "/admin");
assert.equal(safeReturnUrl("//evil.tld"), "/studio/video");
assert.equal(safeReturnUrl("https://evil.tld"), "/studio/video");
assert.equal(safeReturnUrl("/%2F%2Fevil.tld"), "/studio/video");
assert.equal(parseReturnUrl("/etc/passwd"), null);
console.log("return-url.selftest ok");
