import assert from "node:assert/strict";

function isBannedMeta(meta) {
  return meta?.banned === true || meta?.banned === "true";
}

function usageFromMeta(meta) {
  return {
    generations: Math.max(0, Math.floor(Number(meta?.generations) || 0)),
    creditsSpent: Math.max(0, Math.floor(Number(meta?.credits_spent) || 0)),
    lastGeneratedAt: typeof meta?.last_generated_at === "string" ? meta.last_generated_at : null,
    banned: isBannedMeta(meta),
  };
}

function usageAfterSpend(meta, cost) {
  const cur = usageFromMeta(meta);
  return {
    generations: cur.generations + 1,
    credits_spent: cur.creditsSpent + Math.max(0, Math.floor(cost)),
  };
}

assert.equal(isBannedMeta({ banned: true }), true);
assert.equal(isBannedMeta({ banned: false }), false);
assert.deepEqual(usageAfterSpend({}, 9), { generations: 1, credits_spent: 9 });
assert.deepEqual(usageAfterSpend({ generations: 2, credits_spent: 12 }, 9), {
  generations: 3,
  credits_spent: 21,
});
assert.equal(usageFromMeta({ banned: "true" }).banned, true);

function writeAppUserPlan(hasRow, email) {
  if (hasRow) return "update";
  return email ? "insert" : "fail";
}
assert.equal(writeAppUserPlan(true, null), "update");
assert.equal(writeAppUserPlan(false, "a@b.co"), "insert");
assert.equal(writeAppUserPlan(false, null), "fail");

function touchAppUserSeed(hasRow) {
  return hasRow ? "keep" : "seed";
}
assert.equal(touchAppUserSeed(true), "keep");
assert.equal(touchAppUserSeed(false), "seed");
console.log("admin-usage.selftest ok");
