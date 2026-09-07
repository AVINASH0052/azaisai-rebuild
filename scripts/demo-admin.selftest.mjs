import assert from "node:assert/strict";

const DEMO_ADMIN_EMAIL = "admin@azaisai.test";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isDemoAdminEmail(email) {
  return normalizeEmail(email ?? "") === DEMO_ADMIN_EMAIL;
}

assert.equal(isDemoAdminEmail("admin@azaisai.test"), true);
assert.equal(isDemoAdminEmail("  Admin@Azaisai.Test "), true);
assert.equal(isDemoAdminEmail("dev@azaisai.test"), false);
assert.equal(isDemoAdminEmail(""), false);
console.log("demo-admin.selftest ok");
