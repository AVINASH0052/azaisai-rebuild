import assert from "node:assert/strict";
import {
  concatCopyArgs,
  concatFilterArgs,
  lastFrameArgs,
  thumbArgs,
  trimArgs,
  writeConcatList,
} from "../apps/worker/src/ffmpeg.mjs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const last = lastFrameArgs("seg.mp4", "seed.jpg");
assert.ok(last.includes("-sseof"));
assert.ok(last.includes("seed.jpg"));

const copy = concatCopyArgs("list.txt", "out.mp4");
assert.deepEqual(copy.slice(0, 5), ["-y", "-f", "concat", "-safe", "0"]);

const filter = concatFilterArgs(["a.mp4", "b.mp4"], "out.mp4");
assert.ok(filter.some((a) => String(a).includes("concat=n=2:v=1:a=1")));

assert.deepEqual(trimArgs("in.mp4", 20, "final.mp4"), [
  "-y",
  "-i",
  "in.mp4",
  "-t",
  "20",
  "-c",
  "copy",
  "final.mp4",
]);
assert.ok(thumbArgs("final.mp4", "thumb.webp").includes("-vf"));

const dir = await mkdtemp(join(tmpdir(), "hearth-ff-"));
const list = join(dir, "list.txt");
await writeConcatList(list, ["/tmp/a.mp4", "/tmp/b.mp4"]);
const body = await readFile(list, "utf8");
assert.match(body, /file '\/tmp\/a\.mp4'/);
assert.match(body, /file '\/tmp\/b\.mp4'/);

console.log("worker-ffmpeg.selftest ok");
