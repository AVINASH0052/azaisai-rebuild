import assert from "node:assert/strict";

function afterEmailLookup(exists) {
  return exists === false ? "signup" : "password";
}

function passwordReady(password, confirm) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (confirm !== undefined && password !== confirm) return "Passwords do not match.";
  return null;
}

function alreadyRegistered(user) {
  return Boolean(user && (user.identities?.length ?? 0) === 0);
}

function authHref(path, opts = {}) {
  const q = new URLSearchParams();
  if (opts.email) q.set("email", opts.email);
  if (opts.returnUrl) q.set("returnUrl", opts.returnUrl);
  if (opts.confirmed) q.set("confirmed", "1");
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

assert.equal(afterEmailLookup(true), "password");
assert.equal(afterEmailLookup(false), "signup");
assert.equal(afterEmailLookup(null), "password");
assert.equal(passwordReady("short"), "Use at least 8 characters.");
assert.equal(passwordReady("longenough", "nope"), "Passwords do not match.");
assert.equal(passwordReady("longenough", "longenough"), null);
assert.equal(alreadyRegistered({ identities: [] }), true);
assert.equal(alreadyRegistered({ identities: [{ id: "1" }] }), false);
assert.equal(alreadyRegistered(null), false);
assert.equal(
  authHref("/auth/signup", { email: "a@b.co", returnUrl: "/studio/video" }),
  "/auth/signup?email=a%40b.co&returnUrl=%2Fstudio%2Fvideo",
);
assert.equal(authHref("/auth/login", { confirmed: true }), "/auth/login?confirmed=1");

function callbackAfterExchange({ confirmed, reset, type }) {
  if (confirmed === "1" || type === "signup") return "confirm";
  if (reset === "1" || type === "recovery") return "reset";
  return "session";
}
assert.equal(callbackAfterExchange({ confirmed: "1", reset: null, type: null }), "confirm");
assert.equal(callbackAfterExchange({ confirmed: null, reset: null, type: "signup" }), "confirm");
assert.equal(callbackAfterExchange({ confirmed: null, reset: "1", type: null }), "reset");
assert.equal(callbackAfterExchange({ confirmed: null, reset: null, type: "recovery" }), "reset");
assert.equal(callbackAfterExchange({ confirmed: null, reset: null, type: "magiclink" }), "session");
console.log("password-flow.selftest ok");
