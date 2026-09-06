import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/providers/registry.ts", "utf8");
assert.match(src, /id: "veo-3-fast"[\s\S]{0,280}availability: "live"/);
assert.match(src, /providerModel: "veo-3.1-fast-generate-preview"/);
assert.match(src, /id: "sora-2"[\s\S]{0,220}availability: "mock_only"/);
assert.match(src, /Google AI Studio/);
console.log("registry.selftest ok");
