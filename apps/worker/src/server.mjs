import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const port = Number(process.env.PORT ?? 8080);
const secret = process.env.WORKER_SECRET;

async function ffmpegVersion() {
  try {
    const { stdout, stderr } = await exec("ffmpeg", ["-version"]);
    return (stdout || stderr).split("\n")[0] ?? "ok";
  } catch {
    return null;
  }
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(data);
}

function unauthorized(res) {
  json(res, 401, { error: "unauthorized" });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://worker.local");
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    const ffmpeg = await ffmpegVersion();
    json(res, 200, { ok: true, service: "hearth-worker", ffmpeg });
    return;
  }
  if (req.method === "POST" && url.pathname === "/jobs") {
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      unauthorized(res);
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let payload = {};
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      json(res, 400, { error: "invalid json" });
      return;
    }
    json(res, 202, { accepted: true, type: payload.type ?? "advance", id: payload.id });
    return;
  }
  json(res, 404, { error: "not found" });
});

server.listen(port, () => {
  console.log(`hearth-worker listening on ${port}`);
});
