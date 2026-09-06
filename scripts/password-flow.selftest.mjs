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

function isEmailSendLimit(message, code) {
  const m = message.toLowerCase();
  const c = (code ?? "").toLowerCase();
  return (
    c === "over_email_send_rate_limit" ||
    m.includes("email rate limit") ||
    m.includes("over_email_send_rate_limit")
  );
}

function friendlyPasswordError(message, code) {
  const m = message.toLowerCase();
  const c = (code ?? "").toLowerCase();
  if (isEmailSendLimit(message, code)) {
    return "A confirmation email was already sent. Check your inbox, or wait a minute.";
  }
  if (c === "over_request_rate_limit" || m.includes("rate limit")) {
    return "Too many tries. Wait a minute and try again.";
  }
  return "Something went wrong. Try again.";
}

assert.equal(isEmailSendLimit("email rate limit exceeded"), true);
assert.equal(isEmailSendLimit("Request rate limit reached", "over_request_rate_limit"), false);
assert.equal(
  friendlyPasswordError("email rate limit exceeded"),
  "A confirmation email was already sent. Check your inbox, or wait a minute.",
);
assert.equal(
  friendlyPasswordError("Request rate limit reached"),
  "Too many tries. Wait a minute and try again.",
);
console.log("password-flow.selftest ok");
