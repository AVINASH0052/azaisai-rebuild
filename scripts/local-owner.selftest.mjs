import assert from "node:assert/strict";

function scopedStorageKey(base, id) {
  if (!id) return null;
  return `${base}.${id}`;
}

assert.equal(scopedStorageKey("azai.jobs", null), null);
assert.equal(scopedStorageKey("azai.jobs", ""), null);
assert.equal(scopedStorageKey("azai.jobs", "user-a"), "azai.jobs.user-a");
assert.notEqual(
  scopedStorageKey("azai.jobs", "user-a"),
  scopedStorageKey("azai.jobs", "user-b"),
);
console.log("local-owner.selftest ok");
