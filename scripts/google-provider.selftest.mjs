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

console.log("google-provider.selftest ok");
