import assert from "node:assert/strict";

const ALLOWED = [
  /^\/studio(\/|$)/,
  /^\/history(\/|$)/,
  /^\/credits(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/auth\/mfa(\/|$)/,
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

function destAfterLogin({ returnUrl, admin, aal, signedIn }) {
  const explicit = parseReturnUrl(returnUrl);
  if (explicit) return explicit;
  if (!signedIn || !admin) return "/studio/video";
  if (admin.demoReadonly || aal === "aal2") return "/admin";
  return "/auth/mfa?returnUrl=%2Fadmin";
}

function afterMfaPath(returnUrl) {
  const dest = parseReturnUrl(returnUrl);
  if (!dest || dest.startsWith("/auth/mfa")) return "/admin";
  return dest;
}

const admin = { role: "operator", demoReadonly: false };
const demo = { role: "support", demoReadonly: true };

assert.equal(
  destAfterLogin({ returnUrl: "/history", admin: null, aal: "aal1", signedIn: true }),
  "/history",
);
assert.equal(
  destAfterLogin({ returnUrl: null, admin: null, aal: "aal1", signedIn: true }),
  "/studio/video",
);
assert.equal(
  destAfterLogin({ returnUrl: null, admin, aal: "aal1", signedIn: true }),
  "/auth/mfa?returnUrl=%2Fadmin",
);
assert.equal(
  destAfterLogin({ returnUrl: null, admin, aal: "aal2", signedIn: true }),
  "/admin",
);
assert.equal(
  destAfterLogin({ returnUrl: null, admin: demo, aal: "aal1", signedIn: true }),
  "/admin",
);
assert.equal(
  destAfterLogin({ returnUrl: "/admin", admin: null, aal: "aal1", signedIn: true }),
  "/admin",
);
assert.equal(
  destAfterLogin({ returnUrl: "//evil.tld", admin, aal: "aal2", signedIn: true }),
  "/admin",
);
assert.equal(afterMfaPath("/auth/mfa"), "/admin");
assert.equal(afterMfaPath("/studio/video"), "/studio/video");

function isAuthCookieName(name) {
  return name === "azai_test_bypass" || name.startsWith("sb-");
}
assert.equal(isAuthCookieName("azai_test_bypass"), true);
assert.equal(isAuthCookieName("sb-wdlq-auth-token"), true);
assert.equal(isAuthCookieName("theme"), false);
console.log("post-login.selftest ok");
