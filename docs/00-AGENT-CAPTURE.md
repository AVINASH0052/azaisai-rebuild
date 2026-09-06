# 00 — Agent Capture Setup (blocking gate)

Source: `https://8x-internal.com/p/8x-agent-capture-setup` — full text archived at
[`research/8x.html`](research/8x.html).

**Nothing in this plan gets implemented until the step-4 canary test passes twice,
in two different sessions.**

---

## What the brief actually asks for

Verbatim requirements, distilled:

| Requirement | Detail |
|---|---|
| Automatic | Must fire on its own. "If you have to remember to run it, it is wrong." |
| Location | `.agent-logs/` in repo root. Committed. Never gitignored. |
| Content | The **prompt** and the **final response** only. No thinking, no tool calls, no diffs, no intermediate steps. |
| Fidelity | Prompt verbatim and in full. No truncation, paraphrase, or cleanup. Wrong answers included. |
| Metadata | UTC timestamp + model name per entry (so a mid-build model switch is visible). |
| Immutability | Never edit, tidy, summarise, or delete an entry after the fact. |
| Commit cadence | Interleaved with the code they produced. Commit order shows working order. |
| Proof | `CAPTURE-TEST.md` in repo root. It is "the first thing we open." |

## Our setup (step 1 answer)

- **Tool:** Claude Code (desktop app, Code tab), running the Claude Agent SDK harness.
- **Model:** `claude-opus-5` — plans *and* executes. No separate planner model. If a
  subagent runs on a different model mid-build, the `model:` field on each entry
  makes that switch visible in the log, which is the point.
- **Automatic mechanism:** yes. Claude Code supports repo-scoped **hooks** in
  `.claude/settings.json`. Two lifecycle events matter:
  - `UserPromptSubmit` — fires on every user prompt, receives the prompt on stdin.
  - `Stop` — fires at end of turn, receives a JSON payload on stdin containing
    `transcript_path`, a path to the JSONL session transcript.

## Implementation

### Files

```
.claude/settings.json          # hook registration (committed)
scripts/agent-capture.mjs      # the capture script (committed)
.agent-logs/                   # output, committed, never gitignored
  2026-09-06_17-42-11_f3e5ccfa.md
CAPTURE-TEST.md                # proof, repo root
```

### `.claude/settings.json`

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command",
                    "command": "node \"$CLAUDE_PROJECT_DIR/scripts/agent-capture.mjs\" prompt" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command",
                    "command": "node \"$CLAUDE_PROJECT_DIR/scripts/agent-capture.mjs\" response" }] }
    ]
  }
}
```

Registering it in `.claude/settings.json` (not `settings.local.json`) is what makes
it repo-scoped and therefore active in **every** session opened on this repo — which
is exactly what step 4.3 checks for.

### `scripts/agent-capture.mjs` — behaviour spec

**Mode `prompt`:**
1. Read hook JSON from stdin → `{ session_id, prompt, cwd }`.
2. Resolve the session's log file. One file per session, named
   `YYYY-MM-DD_HH-MM-SS_<short-session-id>.md`, timestamp = time of the session's
   *first* prompt. Persist the mapping in `.agent-logs/.index.json` so later turns in
   the same session append to the same file rather than creating a new one.
   *(`.index.json` is machine state, not a log — it is the one thing in the folder
   that gets rewritten, and it is gitignored.)*
3. If the file is new, write the YAML frontmatter + header block.
4. Append a `[LOG_ENTRY type=PROMPT num=N session=<short>]` block with UTC timestamp,
   model, and the prompt verbatim.
5. Increment `total_exchanges`, update `last_prompt_time` in frontmatter.

**Mode `response`:**
1. Read hook JSON from stdin → `{ session_id, transcript_path, stop_hook_active }`.
2. If `stop_hook_active` is true, exit 0 immediately (prevents recursion).
3. Read the JSONL transcript. Walk **backwards** to the most recent `user` message,
   then collect every `assistant` message after it. From those, keep only
   `content[].type === "text"` blocks. Explicitly **drop**:
   - `type: "thinking"` and `type: "redacted_thinking"`
   - `type: "tool_use"` and `type: "tool_result"`
   - any message with `isMeta: true` or `isSidechain: true` (subagent chatter)
4. Join the surviving text blocks with `\n\n` → that is "the final response for that
   prompt", which is precisely what the brief asks for.
5. Append a `[LOG_ENTRY type=RESPONSE num=N session=<short>]` block.

**Hard rules baked into the script:**
- Append-only. The script has no code path that rewrites or deletes an existing
  `LOG_ENTRY` block. Frontmatter counters are the only mutable region.
- Never truncate. No `.slice()` on prompt or response text.
- Fail loud but never block: on error, write `.agent-logs/.capture-errors.log` and
  exit 0, so a capture bug can never wedge the build session.
- Model name read from the transcript's `message.model` field, falling back to
  `$CLAUDE_MODEL`, falling back to `unknown`.

### Output format

Matches the 8x template exactly:

```
---
session_id: f3e5ccfa-3e6e-45bd-9140-4dbde763871c
date: 2026-09-06
author: <github-handle>
model: claude-opus-5
tool: claude-code
project: azaisai-rebuild
total_exchanges: 34
first_prompt_time: 2026-09-06T11:42:11.118Z
last_prompt_time: 2026-09-06T21:47:35.902Z
---

# Session Log - 2026-09-06

Session: `f3e5ccfa` | Project: `azaisai-rebuild` | Author: `<github-handle>`

---

[LOG_ENTRY type=PROMPT num=1 session=f3e5ccfa]
timestamp: 2026-09-06T11:42:11.118Z
model: claude-opus-5

<prompt verbatim>


[LOG_ENTRY type=RESPONSE num=1 session=f3e5ccfa]
timestamp: 2026-09-06T11:44:02.663Z
model: claude-opus-5

<final response text>
```

## Step 4 — verification protocol

1. Send canary `CAPTURE TEST — 8x assignment, <name>` in session A.
2. `grep -c LOG_ENTRY .agent-logs/*.md` → confirm **both** a PROMPT and a RESPONSE
   entry landed, and that the response contains no `tool_use` or thinking residue.
3. Open a **new** session (fresh Claude Code session on the same repo), send a second
   canary. Confirm a *second* file appears. This is the test that catches a hook
   installed only in the current session's memory.
4. Write `CAPTURE-TEST.md` containing:
   - Tool + model (step 1 answer above)
   - Mechanism: Claude Code hooks; config file: `.claude/settings.json`; script:
     `scripts/agent-capture.mjs`
   - Path to the log files both canaries landed in
   - Both canary entries pasted raw
   - **Anything tried first that did not work** — recorded honestly, not cleaned up

### `.gitignore` — what is and is not ignored

```gitignore
# .agent-logs/ is NOT ignored. It ships with the repo.
.agent-logs/.index.json
.agent-logs/.capture-errors.log
```

## Commit discipline during the build

Every task in [11-DELIVERY-PLAN.md](11-DELIVERY-PLAN.md) ends with a commit that
includes both the code and the `.agent-logs/` delta from that stretch of work.
No squashing, no rewriting history, no tidying the log before the final push.
Dead ends stay in — the brief explicitly says they are the most useful part.

## Note on log contents and secrets

`.agent-logs/` is public. The capture script writes prompts and responses verbatim,
so **no secret is ever pasted into a prompt.** All keys go into `.env.local` (gitignored)
and Vercel environment variables, set through the dashboard or `vercel env add`, never
typed into the chat. This is a working rule for the whole build, not a filter in the
script — a filter would mean editing entries, which the brief forbids.
