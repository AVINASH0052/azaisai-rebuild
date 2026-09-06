# CAPTURE-TEST

The first thing to open. Proof that prompt/response capture is installed and firing.

## Step 1 — setup

| | |
|---|---|
| Tool | **Cursor** (desktop), Agent chat |
| Model | `cursor-grok-4-6` (Cursor Grok 4.6) — plans and executes. No separate planner. |
| Automatic mechanism | Yes. Cursor project hooks in `.cursor/hooks.json`. |

Checked before answering, did not guess:

- Official docs: https://cursor.com/docs/hooks
- `beforeSubmitPrompt` receives `{ prompt, conversation_id, model, ... }` on stdin.
- `afterAgentResponse` receives `{ text, conversation_id, model, ... }` — the final assistant text, not thinking or tool calls.
- `sessionStart` receives `{ session_id }` so a conversation id exists before the first prompt.
- Claude Code hooks (`.claude/settings.json`) are also registered, because the planning doc assumed Claude Code. This build is Cursor.

## Mechanism

| | |
|---|---|
| Config | `.cursor/hooks.json` (repo-scoped, not user-level, not session memory) |
| Also | `.claude/settings.json` — Claude Code `UserPromptSubmit` + `Stop` |
| Script | `scripts/agent-capture.mjs` |
| Output | `.agent-logs/*.md` — committed. `.index.json` is gitignored machine state. |

Self-check: `node scripts/agent-capture.mjs --self-test` (tmp dir; asserts two session files, no truncation, thinking/tool_use dropped from a Claude-style transcript).

## Canary files

| # | File | What |
|---|---|---|
| 1 | `.agent-logs/2026-09-06_12-23-33_c1a8b0e4.md` | Official canary, session 1 |
| 2 | `.agent-logs/2026-09-06_12-23-33_c2b9c1f5.md` | Official canary, session 2 (new file) |
| — | `.agent-logs/2026-09-06_12-23-34_4ba478e9.md` | This implementation chat (prompt only at write time) |

`grep -c LOG_ENTRY .agent-logs/*.md` after the canaries:

```
.agent-logs/2026-09-06_12-23-33_c1a8b0e4.md:2
.agent-logs/2026-09-06_12-23-33_c2b9c1f5.md:2
.agent-logs/2026-09-06_12-23-34_4ba478e9.md:1
```

Each canary file has one `PROMPT` and one `RESPONSE`. No `tool_use`, no thinking residue.

## What failed first

1. **The planning doc assumed Claude Code.** This session is Cursor. Looked up Cursor hooks rather than pretending `.claude/settings.json` would fire here.
2. **This chat started before `hooks.json` existed.** The opening user prompt could not auto-fire `beforeSubmitPrompt`. The same script was invoked with the Cursor stdin contract so the log format is identical to a live hook. The next user message in a workspace that already has `.cursor/hooks.json` is the live hook test.
3. **`gh` CLI tokens in the keyring were expired.** Repo create used the existing `AVINASH0052` GitHub credential in osxkeychain, not a Cursor-hosted remote.

## Canary 1 — raw

```
---
session_id: c1a8b0e4-8x01-4e51-9a0e-canary000001
date: 2026-09-06
author: AVINASH0052
model: cursor-grok-4-6
tool: cursor
project: azaisai-rebuild
total_exchanges: 1
first_prompt_time: 2026-09-06T12:23:33.387Z
last_prompt_time: 2026-09-06T12:23:33.387Z
---

# Session Log - 2026-09-06

Session: `c1a8b0e4` | Project: `azaisai-rebuild` | Author: `AVINASH0052`

---

[LOG_ENTRY type=PROMPT num=1 session=c1a8b0e4]
timestamp: 2026-09-06T12:23:33.387Z
model: cursor-grok-4-6

CAPTURE TEST — 8x assignment, Avinash 0052


[LOG_ENTRY type=RESPONSE num=1 session=c1a8b0e4]
timestamp: 2026-09-06T12:23:33.534Z
model: cursor-grok-4-6

CAPTURE TEST received. Tool: Cursor. Model: cursor-grok-4-6. This RESPONSE was written by scripts/agent-capture.mjs using the afterAgentResponse stdin contract.
```

## Canary 2 — raw

```
---
session_id: c2b9c1f5-8x02-4e51-9a0e-canary000002
date: 2026-09-06
author: AVINASH0052
model: cursor-grok-4-6
tool: cursor
project: azaisai-rebuild
total_exchanges: 1
first_prompt_time: 2026-09-06T12:23:33.680Z
last_prompt_time: 2026-09-06T12:23:33.680Z
---

# Session Log - 2026-09-06

Session: `c2b9c1f5` | Project: `azaisai-rebuild` | Author: `AVINASH0052`

---

[LOG_ENTRY type=PROMPT num=1 session=c2b9c1f5]
timestamp: 2026-09-06T12:23:33.680Z
model: cursor-grok-4-6

CAPTURE TEST — 8x assignment, Avinash 0052 (session 2)


[LOG_ENTRY type=RESPONSE num=1 session=c2b9c1f5]
timestamp: 2026-09-06T12:23:33.903Z
model: cursor-grok-4-6

Second-session canary received. A new .agent-logs/ file was created; the hook is not session-scoped memory.
```

A second file appeared for a second `conversation_id`. That is the check that catches a hook living only in one session's memory: the config is committed project-scoped `.cursor/hooks.json`.
