import assert from "node:assert/strict";

const PLATFORM_DEFAULTS = {
  "generations.concurrent": 1,
  "spend.daily_cents": 50,
  "api.enabled": false,
  "models.allowed_tiers": ["fast"],
};

function layerPolicies(base, plan, override) {
  const limits = { ...base };
  const source = Object.fromEntries(Object.keys(base).map((k) => [k, "platform"]));
  for (const [layer, tag] of [
    [plan, "plan"],
    [override, "override"],
  ]) {
    for (const key of Object.keys(base)) {
      const next = layer[key];
      if (next === undefined || next === null) continue;
      limits[key] = next;
      source[key] = tag;
    }
  }
  return { limits, source };
}

function clampPolicy(merged, clamps) {
  const limits = { ...merged.limits };
  const source = { ...merged.source };
  for (const key of Object.keys(limits)) {
    const cap = clamps[key];
    if (cap == null) continue;
    const cur = limits[key];
    if (typeof cur === "number" && typeof cap === "number" && cap < cur) {
      limits[key] = cap;
      source[key] = "clamp";
    }
    if (typeof cur === "boolean" && typeof cap === "boolean") {
      limits[key] = cur && cap;
      if (cur && !cap) source[key] = "clamp";
    }
    if (Array.isArray(cur) && Array.isArray(cap)) {
      const next = cur.filter((x) => cap.includes(x));
      if (next.length !== cur.length) {
        limits[key] = next;
        source[key] = "clamp";
      }
    }
  }
  return { limits, source };
}

const layered = layerPolicies(
  PLATFORM_DEFAULTS,
  { "generations.concurrent": 5, "api.enabled": true, "models.allowed_tiers": ["fast", "standard"] },
  { "generations.concurrent": 8 },
);
assert.equal(layered.limits["generations.concurrent"], 8);
assert.equal(layered.source["generations.concurrent"], "override");
assert.equal(layered.source["api.enabled"], "plan");

const clamped = clampPolicy(layered, { "generations.concurrent": 2 });
assert.equal(clamped.limits["generations.concurrent"], 2);
assert.equal(clamped.source["generations.concurrent"], "clamp");
assert.equal(clamped.limits["api.enabled"], true);

console.log("policy.selftest ok");
