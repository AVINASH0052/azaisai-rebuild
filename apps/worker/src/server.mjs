import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  concatVideos,
  extractLastFrame,
  trimVideo,
  writeThumb,
} from "./ffmpeg.mjs";

const exec = promisify(execFile);
const port = Number(process.env.PORT ?? 8080);
const secret = process.env.WORKER_SECRET;
const googleKey = process.env.GOOGLE_AI_STUDIO;
const root = join(tmpdir(), "hearth-jobs");

// ponytail: job files live in /tmp; Cloud Run scale-to-zero drops them. Upgrade: Supabase Storage.
const jobs = new Map();

async function ffmpegVersion() {
  try {
    const { stdout, stderr } = await exec("ffmpeg", ["-version"]);
    return (stdout || stderr).split("\n")[0] ?? "ok";
  } catch {
    return null;
  }
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function unauthorized(res) {
  json(res, 401, { error: "unauthorized" });
}

function authorized(req) {
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function downloadUri(uri, dest) {
  const headers = {};
  if (googleKey) headers["x-goog-api-key"] = googleKey;
  const res = await fetch(uri, { headers });
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function lastFrameJob(payload) {
  const dir = join(root, payload.id ?? `frame-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const video = join(dir, "src.mp4");
  const frame = join(dir, "seed.jpg");
  await downloadUri(payload.videoUri, video);
  await extractLastFrame(video, frame);
  const data = await readFile(frame);
  return { mimeType: "image/jpeg", data: data.toString("base64") };
}

async function stitchJob(payload) {
  const id = payload.id;
  if (!id) throw new Error("id required");
  const uris = payload.videoUris ?? [];
  if (!uris.length) throw new Error("videoUris required");
  const dir = join(root, id);
  await mkdir(dir, { recursive: true });
  const segs = [];
  for (const [i, uri] of uris.entries()) {
    const dest = join(dir, `seg${i}.mp4`);
    await downloadUri(uri, dest);
    segs.push(dest);
  }
  const joined = join(dir, "joined.mp4");
  const finalPath = join(dir, "final.mp4");
  const thumb = join(dir, "thumb.webp");
  if (segs.length === 1) {
    await writeFile(joined, await readFile(segs[0]));
  } else {
    await concatVideos(segs, joined);
  }
  const durationSec = Number(payload.durationSec);
  if (Number.isFinite(durationSec) && durationSec > 0) {
    try {
      await trimVideo(joined, durationSec, finalPath);
    } catch {
      await writeFile(finalPath, await readFile(joined));
    }
  } else {
    await writeFile(finalPath, await readFile(joined));
  }
  try {
    await writeThumb(finalPath, thumb);
  } catch {
    // thumbnail is optional
  }
  jobs.set(id, { status: "ready", file: finalPath, thumb });
  return { id, ready: true };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://worker.local");
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    const ffmpeg = await ffmpegVersion();
    json(res, 200, { ok: true, service: "hearth-worker", ffmpeg });
    return;
  }

  const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
  const fileMatch = url.pathname.match(/^\/jobs\/([^/]+)\/file$/);
  if (req.method === "GET" && (jobMatch || fileMatch)) {
    if (!authorized(req)) {
      unauthorized(res);
      return;
    }
    const id = decodeURIComponent((jobMatch ?? fileMatch)[1]);
    const job = jobs.get(id);
    if (fileMatch) {
      if (!job?.file) {
        json(res, 404, { error: "not found" });
        return;
      }
      res.writeHead(200, { "content-type": "video/mp4" });
      createReadStream(job.file).pipe(res);
      return;
    }
    json(res, job ? 200 : 404, job ? { id, status: job.status } : { error: "not found" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/jobs") {
    if (!authorized(req)) {
      unauthorized(res);
      return;
    }
    let payload = {};
    try {
      payload = await readBody(req);
    } catch {
      json(res, 400, { error: "invalid json" });
      return;
    }
    const type = payload.type ?? "ping";
    try {
      if (type === "last_frame") {
        json(res, 200, await lastFrameJob(payload));
        return;
      }
      if (type === "stitch") {
        json(res, 200, await stitchJob(payload));
        return;
      }
      json(res, 202, { accepted: true, type, id: payload.id });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : "job failed" });
    }
    return;
  }

  json(res, 404, { error: "not found" });
});

server.listen(port, () => {
  console.log(`hearth-worker listening on ${port}`);
});
