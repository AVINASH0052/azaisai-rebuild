import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";

const exec = promisify(execFile);

export function lastFrameArgs(input, output) {
  return ["-y", "-sseof", "-0.5", "-i", input, "-update", "1", "-frames:v", "1", "-q:v", "2", output];
}

export function concatCopyArgs(listFile, output) {
  return ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", output];
}

export function concatFilterArgs(inputs, output) {
  const args = ["-y"];
  for (const file of inputs) args.push("-i", file);
  const n = inputs.length;
  const labels = inputs.map((_, i) => `[${i}:v][${i}:a]`).join("");
  args.push(
    "-filter_complex",
    `${labels}concat=n=${n}:v=1:a=1[v][a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    output,
  );
  return args;
}

export function concatVideoOnlyArgs(inputs, output) {
  const args = ["-y"];
  for (const file of inputs) args.push("-i", file);
  const labels = inputs.map((_, i) => `[${i}:v]`).join("");
  args.push(
    "-filter_complex",
    `${labels}concat=n=${inputs.length}:v=1:a=0[v]`,
    "-map",
    "[v]",
    output,
  );
  return args;
}

export function trimArgs(input, durationSec, output) {
  return ["-y", "-i", input, "-t", String(durationSec), "-c", "copy", output];
}

export function thumbArgs(input, output) {
  return ["-y", "-ss", "1", "-i", input, "-frames:v", "1", "-vf", "scale=640:-1", output];
}

export async function runFfmpeg(args) {
  await exec("ffmpeg", args, { timeout: 120_000 });
}

export async function writeConcatList(listFile, files) {
  const body = files.map((f) => `file '${f.replaceAll("'", "'\\''")}'`).join("\n");
  await writeFile(listFile, body, "utf8");
}

export async function extractLastFrame(input, output) {
  await runFfmpeg(lastFrameArgs(input, output));
}

export async function concatVideos(files, output) {
  const listFile = `${output}.list.txt`;
  await writeConcatList(listFile, files);
  try {
    await runFfmpeg(concatCopyArgs(listFile, output));
    return;
  } catch {
    // ponytail: stream-copy fails if Veo segments differ; re-encode, then video-only
  }
  try {
    await runFfmpeg(concatFilterArgs(files, output));
  } catch {
    await runFfmpeg(concatVideoOnlyArgs(files, output));
  }
}

export async function trimVideo(input, durationSec, output) {
  await runFfmpeg(trimArgs(input, durationSec, output));
}

export async function writeThumb(input, output) {
  await runFfmpeg(thumbArgs(input, output));
}
