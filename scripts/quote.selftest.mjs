import assert from "node:assert/strict";

const MIN_VIDEO_SEC = 4;
const MAX_VIDEO_SEC = 20;

function clampDuration(value) {
  if (!Number.isFinite(value)) return 8;
  return Math.min(MAX_VIDEO_SEC, Math.max(MIN_VIDEO_SEC, Math.round(value)));
}

function shortestAtoms(target) {
  if (target < 4) return null;
  for (let eights = Math.floor(target / 8); eights >= 0; eights--) {
    const after8 = target - eights * 8;
    for (let sixes = Math.floor(after8 / 6); sixes >= 0; sixes--) {
      const rem = after8 - sixes * 6;
      if (rem % 4 !== 0) continue;
      return [...Array(eights).fill(8), ...Array(sixes).fill(6), ...Array(rem / 4).fill(4)];
    }
  }
  return null;
}

function clipPlan(durationSec) {
  const want = clampDuration(durationSec);
  const atoms = shortestAtoms(want) ?? shortestAtoms(want + 1) ?? [8];
  return atoms;
}

function generatedSeconds(durationSec) {
  return clipPlan(durationSec).reduce((sum, n) => sum + n, 0);
}

function segmentCount(durationSec) {
  return clipPlan(durationSec).length;
}

function quoteCredits(model, durationSec) {
  if (model.credits.per === "image") return model.credits.rate;
  const duration = durationSec ?? 8;
  return Math.ceil(model.credits.rate * generatedSeconds(duration));
}

assert.deepEqual(clipPlan(4), [4]);
assert.deepEqual(clipPlan(5), [6]);
assert.deepEqual(clipPlan(6), [6]);
assert.deepEqual(clipPlan(8), [8]);
assert.deepEqual(clipPlan(10), [6, 4]);
assert.deepEqual(clipPlan(12), [8, 4]);
assert.deepEqual(clipPlan(16), [8, 8]);
assert.deepEqual(clipPlan(20), [8, 8, 4]);
assert.equal(generatedSeconds(6), 6);
assert.equal(generatedSeconds(10), 10);
assert.equal(quoteCredits({ credits: { per: "second", rate: 1.5 } }, 6), 9);
assert.equal(quoteCredits({ credits: { per: "second", rate: 1.5 } }, 8), 12);
assert.ok(80 >= quoteCredits({ credits: { per: "second", rate: 1.5 } }, 6));
assert.equal(quoteCredits({ credits: { per: "second", rate: 1 } }, 20), 20);
assert.equal(quoteCredits({ credits: { per: "second", rate: 1 } }, 12), 12);
assert.equal(quoteCredits({ credits: { per: "second", rate: 1 } }, 5), 6);
assert.equal(quoteCredits({ credits: { per: "image", rate: 2 } }), 2);
assert.equal(segmentCount(20), 3);
assert.equal(segmentCount(10), 2);
assert.equal(segmentCount(6), 1);
assert.equal(clampDuration(99), 20);
assert.equal(clampDuration(1), 4);
console.log("quote.selftest ok");
