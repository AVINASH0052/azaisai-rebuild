import assert from "node:assert/strict";

const SEGMENT_SEC = 8;
const MIN_VIDEO_SEC = 4;
const MAX_VIDEO_SEC = 20;
const MAX_SEGMENTS = Math.ceil(MAX_VIDEO_SEC / SEGMENT_SEC);

function clampDuration(value) {
  if (!Number.isFinite(value)) return 8;
  return Math.min(MAX_VIDEO_SEC, Math.max(MIN_VIDEO_SEC, Math.round(value)));
}

function segmentCount(durationSec) {
  return Math.min(MAX_SEGMENTS, Math.max(1, Math.ceil(clampDuration(durationSec) / SEGMENT_SEC)));
}

function generatedSeconds(durationSec) {
  return segmentCount(durationSec) * SEGMENT_SEC;
}

function quoteCredits(model, durationSec) {
  if (model.credits.per === "image") return model.credits.rate;
  const duration = durationSec ?? 8;
  return Math.ceil(model.credits.rate * generatedSeconds(duration));
}

assert.equal(quoteCredits({ credits: { per: "second", rate: 1.5 } }, 8), 12);
assert.equal(quoteCredits({ credits: { per: "second", rate: 1 } }, 20), 24);
assert.equal(quoteCredits({ credits: { per: "second", rate: 1 } }, 12), 16);
assert.equal(quoteCredits({ credits: { per: "second", rate: 1 } }, 5), 8);
assert.equal(quoteCredits({ credits: { per: "image", rate: 2 } }), 2);
assert.equal(segmentCount(20), 3);
assert.equal(segmentCount(21), 3);
assert.equal(clampDuration(99), 20);
assert.equal(clampDuration(1), 4);
console.log("quote.selftest ok");
