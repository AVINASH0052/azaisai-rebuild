import assert from "node:assert/strict";

const DEMO_ADMIN_EMAIL = "admin@hearth.com";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isDemoAdminEmail(email) {
  return normalizeEmail(email ?? "") === DEMO_ADMIN_EMAIL;
}

assert.equal(isDemoAdminEmail("admin@hearth.com"), true);
assert.equal(isDemoAdminEmail("  Admin@Hearth.Com "), true);
assert.equal(isDemoAdminEmail("admin@azaisai.test"), false);
assert.equal(isDemoAdminEmail("dev@azaisai.test"), false);
assert.equal(isDemoAdminEmail(""), false);
console.log("demo-admin.selftest ok");
