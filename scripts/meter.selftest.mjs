import assert from "node:assert/strict";

const STARTING_CREDITS = 80;

function creditsFromMeta(meta) {
  const n = Number(meta?.credits);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : STARTING_CREDITS;
}

function spendFrom(balance, cost) {
  const c = Math.max(0, Math.floor(cost));
  if (c <= 0) return { ok: true, balance, charged: 0 };
  if (balance < c) return { ok: false, balance, charged: 0 };
  return { ok: true, balance: balance - c, charged: c };
}

function refundTo(balance, cost) {
  const c = Math.max(0, Math.floor(cost));
  return Math.min(STARTING_CREDITS, balance + c);
}

function spentFrom(balance) {
  return Math.max(0, STARTING_CREDITS - balance);
}

assert.equal(creditsFromMeta(undefined), 80);
assert.equal(creditsFromMeta({}), 80);
assert.equal(creditsFromMeta({ credits: 71 }), 71);
assert.equal(creditsFromMeta({ credits: -3 }), 0);
assert.deepEqual(spendFrom(80, 9), { ok: true, balance: 71, charged: 9 });
assert.deepEqual(spendFrom(5, 9), { ok: false, balance: 5, charged: 0 });
assert.deepEqual(spendFrom(9, 9), { ok: true, balance: 0, charged: 9 });
assert.equal(spendFrom(0, 1).ok, false);
assert.equal(refundTo(71, 9), 80);
assert.equal(refundTo(80, 9), 80);
assert.equal(spentFrom(71), 9);
assert.equal(spentFrom(80), 0);
assert.equal(spentFrom(0), 80);
console.log("meter.selftest ok");
