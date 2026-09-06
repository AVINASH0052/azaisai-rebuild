import assert from "node:assert/strict";

function veoPredictBody(req) {
  const instance = { prompt: req.prompt };
  if (req.seedImage) {
    instance.image = {
      bytesBase64Encoded: req.seedImage.data,
      mimeType: req.seedImage.mimeType,
    };
  }
  return {
    instances: [instance],
    parameters: {
      aspectRatio: req.aspect === "9:16" ? "9:16" : "16:9",
      resolution: "720p",
      durationSeconds: 8,
      sampleCount: 1,
    },
  };
}

function videoUriFromOperation(data) {
  const sample = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
  if (sample?.uri) return sample.uri;
  const listed = data.response?.videos?.[0];
  return listed?.uri ?? listed?.gcsUri;
}

const t2v = veoPredictBody({ prompt: "drone", aspect: "16:9" });
assert.equal(t2v.instances[0].prompt, "drone");
assert.equal(t2v.instances[0].image, undefined);
assert.equal(t2v.parameters.durationSeconds, 8);

const i2v = veoPredictBody({
  prompt: "continues",
  aspect: "9:16",
  seedImage: { mimeType: "image/jpeg", data: "abc" },
});
assert.deepEqual(i2v.instances[0].image, {
  bytesBase64Encoded: "abc",
  mimeType: "image/jpeg",
});
assert.equal(i2v.parameters.aspectRatio, "9:16");

assert.equal(
  videoUriFromOperation({
    response: { generateVideoResponse: { generatedSamples: [{ video: { uri: "https://v" } }] } },
  }),
  "https://v",
);
assert.equal(videoUriFromOperation({ done: true }), undefined);

function byteRange(header, total) {
  if (total <= 0) return { start: 0, end: 0, status: 200 };
  if (!header) return { start: 0, end: total - 1, status: 200 };
  const m = /bytes=(\d+)-(\d*)/.exec(header);
  if (!m) return { start: 0, end: total - 1, status: 200 };
  const start = Math.min(Number(m[1]), total - 1);
  const end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
  if (start > end) return { start: 0, end: total - 1, status: 200 };
  const partial = start > 0 || end < total - 1;
  return { start, end, status: partial ? 206 : 200 };
}

assert.deepEqual(byteRange(null, 1000), { start: 0, end: 999, status: 200 });
assert.deepEqual(byteRange("bytes=0-99", 1000), { start: 0, end: 99, status: 206 });
assert.deepEqual(byteRange("bytes=500-", 1000), { start: 500, end: 999, status: 206 });

console.log("google-provider.selftest ok");
