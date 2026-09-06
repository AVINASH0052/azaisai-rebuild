import assert from "node:assert/strict";

function afterSegmentReady(state, uri, hasWorker) {
  const videoUris = [...state.videoUris, uri];
  if (videoUris.length < state.segments) {
    return { action: "chain", nextIndex: videoUris.length, seedFromUri: uri, videoUris };
  }
  if (hasWorker) return { action: "stitch", videoUris };
  return { action: "ready", videoUris };
}

const first = afterSegmentReady({ segment: 0, segments: 3, videoUris: [] }, "u1", true);
assert.deepEqual(first, { action: "chain", nextIndex: 1, seedFromUri: "u1", videoUris: ["u1"] });

const noWorker = afterSegmentReady({ segment: 0, segments: 3, videoUris: [] }, "u1", false);
assert.deepEqual(noWorker, { action: "chain", nextIndex: 1, seedFromUri: "u1", videoUris: ["u1"] });

const last = afterSegmentReady(
  { segment: 2, segments: 3, videoUris: ["u1", "u2"] },
  "u3",
  true,
);
assert.deepEqual(last, { action: "stitch", videoUris: ["u1", "u2", "u3"] });

const playlist = afterSegmentReady(
  { segment: 2, segments: 3, videoUris: ["u1", "u2"] },
  "u3",
  false,
);
assert.deepEqual(playlist, { action: "ready", videoUris: ["u1", "u2", "u3"] });

const single = afterSegmentReady({ segment: 0, segments: 1, videoUris: [] }, "u1", false);
assert.deepEqual(single, { action: "ready", videoUris: ["u1"] });

console.log("pipeline.selftest ok");
