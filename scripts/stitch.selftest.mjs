import assert from "node:assert/strict";

function clipStillPlaying(currentTime, ended, limit) {
  if (ended) return false;
  if (limit != null && currentTime >= limit) return false;
  return true;
}

function recorderMime(isTypeSupported) {
  const mimes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return mimes.find((type) => isTypeSupported(type)) ?? "";
}

function stitchFilename(id, mime) {
  return `hearth-${id}.${mime.includes("mp4") ? "mp4" : "webm"}`;
}

function imageFilename(id, src) {
  if (src.startsWith("data:image/jpeg")) return `hearth-${id}.jpg`;
  if (src.startsWith("data:image/webp")) return `hearth-${id}.webp`;
  return `hearth-${id}.png`;
}

assert.equal(clipStillPlaying(5.9, false, 6), true);
assert.equal(clipStillPlaying(6, false, 6), false);
assert.equal(clipStillPlaying(3, true, 6), false);
assert.equal(clipStillPlaying(10, false), true);
assert.equal(recorderMime(() => false), "");
assert.equal(recorderMime((t) => t === "video/mp4"), "video/mp4");
assert.equal(stitchFilename("g1", "video/webm;codecs=vp9"), "hearth-g1.webm");
assert.equal(stitchFilename("g1", "video/mp4"), "hearth-g1.mp4");
assert.equal(imageFilename("i1", "data:image/png;base64,xx"), "hearth-i1.png");
assert.equal(imageFilename("i1", "data:image/jpeg;base64,xx"), "hearth-i1.jpg");
console.log("stitch.selftest ok");
