import assert from "node:assert/strict";

function quoteCredits(model, durationSec) {
  if (model.credits.per === "second") {
    const sec = durationSec ?? model.capabilities.durations?.[0] ?? 4;
    return Math.ceil(model.credits.rate * sec);
  }
  return model.credits.rate;
}

assert.equal(quoteCredits({ credits: { per: "second", rate: 1.5 }, capabilities: { durations: [4] } }, 8), 12);
assert.equal(quoteCredits({ credits: { per: "image", rate: 2 }, capabilities: {} }), 2);
assert.equal(quoteCredits({ credits: { per: "second", rate: 1 }, capabilities: { durations: [4] } }), 4);
console.log("quote.selftest ok");
