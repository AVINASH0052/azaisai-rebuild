#!/usr/bin/env node
// Automatic prompt/response capture for the 8x assignment.
// Append-only. Never truncates. Fail-open (exit 0) so a capture bug cannot wedge a session.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AUTHOR = process.env.CAPTURE_AUTHOR || "AVINASH0052";
const PROJECT = "azaisai-rebuild";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(SCRIPT_DIR, "..");

function now() {
  return new Date();
}

function iso(d = now()) {
  return d.toISOString();
}

function fileStamp(d) {
  return d.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
}

function shortId(sessionId) {
  const compact = String(sessionId).replace(/-/g, "");
  return compact.slice(0, 8) || "unknown";
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8")),
    );
    process.stdin.on("error", () => resolve(""));
  });
}

function parseJson(raw) {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return {};
  return JSON.parse(text);
}

function repoRoot(payload) {
  if (process.env.CAPTURE_ROOT) return process.env.CAPTURE_ROOT;
  const hints = [
    process.env.CLAUDE_PROJECT_DIR,
    ...(Array.isArray(payload.workspace_roots) ? payload.workspace_roots : []),
    DEFAULT_ROOT,
    process.cwd(),
  ].filter(Boolean);
  for (const hint of hints) {
    let dir = hint;
    for (let i = 0; i < 8; i++) {
      if (
        existsSync(join(dir, "scripts", "agent-capture.mjs")) ||
        existsSync(join(dir, ".git"))
      ) {
        return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return DEFAULT_ROOT;
}

function logsDir(root) {
  const dir = join(root, ".agent-logs");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeError(root, err) {
  try {
    const line = `${iso()} ${err?.stack || err?.message || String(err)}\n`;
    appendFileSync(join(logsDir(root), ".capture-errors.log"), line);
  } catch {
    // last resort: never throw out of the fail-open path
  }
}

function loadIndex(dir) {
  const path = join(dir, ".index.json");
  if (!existsSync(path)) return { sessions: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { sessions: {} };
  }
}

function saveIndex(dir, index) {
  writeFileSync(join(dir, ".index.json"), JSON.stringify(index, null, 2) + "\n");
}

function detectMode(argv, payload) {
  const arg = argv[2];
  if (arg === "prompt" || arg === "response" || arg === "session") return arg;
  const ev = String(payload.hook_event_name || "");
  if (ev === "beforeSubmitPrompt" || ev === "UserPromptSubmit") return "prompt";
  if (ev === "afterAgentResponse" || ev === "AgentResponse") return "response";
  if (ev === "sessionStart") return "session";
  if (ev === "stop" || ev === "Stop") return "response";
  if (payload.prompt != null) return "prompt";
  if (payload.text != null || payload.transcript_path) return "response";
  return "unknown";
}

function detectTool(payload) {
  const ev = String(payload.hook_event_name || "");
  if (ev === "UserPromptSubmit" || ev === "Stop" || process.env.CLAUDE_PROJECT_DIR) {
    return "claude-code";
  }
  return "cursor";
}

function detectModel(payload, extra) {
  return (
    extra ||
    payload.model ||
    payload.model_id ||
    process.env.CLAUDE_MODEL ||
    process.env.CURSOR_MODEL ||
    "unknown"
  );
}

function sessionIdOf(payload, index) {
  return (
    payload.session_id ||
    payload.conversation_id ||
    index.lastSessionId ||
    "unknown"
  );
}

function newSessionFile(dir, sessionId, started) {
  const short = shortId(sessionId);
  return `${fileStamp(started)}_${short}.md`;
}

function header(sessionId, started, model, tool) {
  const date = started.toISOString().slice(0, 10);
  const short = shortId(sessionId);
  return `---
session_id: ${sessionId}
date: ${date}
author: ${AUTHOR}
model: ${model}
tool: ${tool}
project: ${PROJECT}
total_exchanges: 0
first_prompt_time: ${iso(started)}
last_prompt_time: ${iso(started)}
---

# Session Log - ${date}

Session: \`${short}\` | Project: \`${PROJECT}\` | Author: \`${AUTHOR}\`

---
`;
}

function setYaml(yaml, key, value) {
  const re = new RegExp(`^${key}:.*$`, "m");
  if (re.test(yaml)) return yaml.replace(re, `${key}: ${value}`);
  return `${yaml}\n${key}: ${value}`;
}

function patchFrontmatter(text, fields) {
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) return text;
  let yaml = text.slice(4, end);
  for (const [k, v] of Object.entries(fields)) yaml = setYaml(yaml, k, v);
  return `---\n${yaml}\n---\n` + text.slice(end + 5);
}

function countEntries(text, type) {
  const re = new RegExp(
    `^\\[LOG_ENTRY type=${type} num=(\\d+)`,
    "gm",
  );
  let max = 0;
  let m;
  while ((m = re.exec(text))) max = Math.max(max, Number(m[1]));
  return max;
}

function resolveSession(dir, payload, started) {
  const index = loadIndex(dir);
  const sessionId = sessionIdOf(payload, index);
  let rec = index.sessions[sessionId];
  if (!rec) {
    rec = {
      file: newSessionFile(dir, sessionId, started),
      short: shortId(sessionId),
      createdAt: iso(started),
    };
    index.sessions[sessionId] = rec;
  }
  index.lastSessionId = sessionId;
  saveIndex(dir, index);
  return { sessionId, rec, path: join(dir, rec.file) };
}

function ensureFile(path, sessionId, started, model, tool) {
  if (existsSync(path)) return readFileSync(path, "utf8");
  const text = header(sessionId, started, model, tool);
  writeFileSync(path, text);
  return text;
}

function isUserEvent(e) {
  return (
    e?.type === "user" || e?.role === "user" || e?.message?.role === "user"
  );
}

function isAssistantEvent(e) {
  return (
    e?.type === "assistant" ||
    e?.role === "assistant" ||
    e?.message?.role === "assistant"
  );
}

function extractTranscriptResponse(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return { text: "", model: null };
  }
  const lines = readFileSync(transcriptPath, "utf8").split("\n");
  const events = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip malformed lines; never throw
    }
  }
  let userIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e?.isMeta || e?.isSidechain) continue;
    if (isUserEvent(e)) {
      userIdx = i;
      break;
    }
  }
  if (userIdx < 0) return { text: "", model: null };
  const texts = [];
  let model = null;
  for (let i = userIdx + 1; i < events.length; i++) {
    const e = events[i];
    if (e?.isMeta || e?.isSidechain) continue;
    if (!isAssistantEvent(e)) continue;
    model = e.message?.model || e.model || model;
    const content = e.message?.content || e.content;
    if (!Array.isArray(content)) {
      if (typeof content === "string" && content) texts.push(content);
      continue;
    }
    for (const block of content) {
      if (block?.type === "text" && typeof block.text === "string") {
        texts.push(block.text);
      }
    }
  }
  return { text: texts.join("\n\n"), model };
}

function writePrompt(root, payload) {
  const started = now();
  const dir = logsDir(root);
  const { sessionId, rec, path } = resolveSession(dir, payload, started);
  const model = detectModel(payload);
  const tool = detectTool(payload);
  let text = ensureFile(path, sessionId, started, model, tool);
  const num = countEntries(text, "PROMPT") + 1;
  const ts = iso(started);
  const prompt =
    payload.prompt != null ? String(payload.prompt) : "";
  const block = `
[LOG_ENTRY type=PROMPT num=${num} session=${rec.short}]
timestamp: ${ts}
model: ${model}

${prompt}

`;
  text = patchFrontmatter(text, {
    total_exchanges: String(num),
    last_prompt_time: ts,
    model,
    tool,
  });
  writeFileSync(path, text + block);
}

function writeResponse(root, payload) {
  const started = now();
  const dir = logsDir(root);
  const { sessionId, rec, path } = resolveSession(dir, payload, started);
  const extracted = payload.transcript_path
    ? extractTranscriptResponse(payload.transcript_path)
    : { text: "", model: null };
  const body =
    payload.text != null
      ? String(payload.text)
      : extracted.text;
  const model = detectModel(payload, extracted.model);
  const tool = detectTool(payload);
  let text = ensureFile(path, sessionId, started, model, tool);
  const num = Math.max(countEntries(text, "PROMPT"), countEntries(text, "RESPONSE") + 1);
  const ts = iso(started);
  const block = `
[LOG_ENTRY type=RESPONSE num=${num} session=${rec.short}]
timestamp: ${ts}
model: ${model}

${body}

`;
  text = patchFrontmatter(text, { model, tool });
  writeFileSync(path, text + block);
}

function writeSession(root, payload) {
  const dir = logsDir(root);
  const index = loadIndex(dir);
  const sessionId = sessionIdOf(payload, index);
  if (sessionId && sessionId !== "unknown") {
    index.lastSessionId = sessionId;
    writeFileSync(join(dir, ".last-session"), sessionId + "\n");
    saveIndex(dir, index);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function selfTest() {
  const tmp = mkdtempSync(join(process.env.TMPDIR || "/tmp", "azai-capture-"));
  process.env.CAPTURE_ROOT = tmp;
  const sid1 = "aaaaaaaa-1111-4e51-9a0e-1c2f83b4de77";
  const sid2 = "bbbbbbbb-2222-4e51-9a0e-1c2f83b4de77";
  const long = "CANARY-LONG " + "x".repeat(8000);
  writePrompt(tmp, {
    conversation_id: sid1,
    prompt: "CAPTURE TEST — 8x assignment, Avinash 0052",
    hook_event_name: "beforeSubmitPrompt",
    model: "cursor-grok-4-6",
  });
  writeResponse(tmp, {
    conversation_id: sid1,
    text: "Canary response one. Capture is working.",
    hook_event_name: "afterAgentResponse",
    model: "cursor-grok-4-6",
  });
  writePrompt(tmp, {
    conversation_id: sid1,
    prompt: long,
    hook_event_name: "beforeSubmitPrompt",
    model: "cursor-grok-4-6",
  });
  const transcript = join(tmp, "t.jsonl");
  writeFileSync(
    transcript,
    [
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "hi" },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-opus-5",
          content: [
            { type: "thinking", text: "secret thought" },
            { type: "tool_use", id: "1", name: "Read", input: {} },
            { type: "text", text: "Visible final answer." },
          ],
        },
      }),
    ].join("\n") + "\n",
  );
  writeResponse(tmp, {
    conversation_id: sid1,
    transcript_path: transcript,
    hook_event_name: "Stop",
  });
  writePrompt(tmp, {
    conversation_id: sid2,
    prompt: "CAPTURE TEST 2 — 8x assignment, Avinash 0052",
    hook_event_name: "beforeSubmitPrompt",
    model: "cursor-grok-4-6",
  });
  writeResponse(tmp, {
    conversation_id: sid2,
    text: "Canary response two.",
    hook_event_name: "afterAgentResponse",
    model: "cursor-grok-4-6",
  });

  const files = readdirSync(join(tmp, ".agent-logs")).filter((f) =>
    f.endsWith(".md"),
  );
  assert(files.length === 2, `expected 2 session files, got ${files.length}`);
  const a = readFileSync(
    join(tmp, ".agent-logs", files.find((f) => f.includes("aaaaaaaa")) || files[0]),
    "utf8",
  );
  const b = readFileSync(
    join(tmp, ".agent-logs", files.find((f) => f.includes("bbbbbbbb")) || files[1]),
    "utf8",
  );
  assert(a.includes("CAPTURE TEST — 8x assignment, Avinash 0052"), "canary 1 prompt missing");
  assert(a.includes(long), "long prompt was truncated");
  assert(a.includes("Canary response one"), "canary 1 response missing");
  assert(a.includes("Visible final answer."), "transcript text missing");
  assert(!a.includes("secret thought"), "thinking leaked");
  assert(!a.includes("tool_use"), "tool_use leaked");
  assert((a.match(/\[LOG_ENTRY type=PROMPT/g) || []).length === 2, "prompt count");
  assert(b.includes("CAPTURE TEST 2"), "canary 2 prompt missing");
  assert(b.includes("Canary response two"), "canary 2 response missing");
  rmSync(tmp, { recursive: true, force: true });
  process.stdout.write("agent-capture self-test ok\n");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const raw = await readStdin();
  let payload = {};
  try {
    payload = parseJson(raw);
  } catch (err) {
    writeError(DEFAULT_ROOT, err);
    return;
  }
  if (payload.stop_hook_active) return;
  const root = repoRoot(payload);
  try {
    const mode = detectMode(process.argv, payload);
    if (mode === "prompt") {
      writePrompt(root, payload);
      process.stdout.write(JSON.stringify({ continue: true }) + "\n");
      return;
    }
    if (mode === "response") {
      writeResponse(root, payload);
      process.stdout.write("{}\n");
      return;
    }
    if (mode === "session") {
      writeSession(root, payload);
      process.stdout.write("{}\n");
      return;
    }
  } catch (err) {
    writeError(root, err);
  }
}

main().catch((err) => {
  writeError(process.env.CAPTURE_ROOT || DEFAULT_ROOT, err);
  process.exit(0);
});
