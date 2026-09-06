# 15 — Git Workflow: how work lands on `main`

## The tension worth naming

Normal practice for a build like this is short-lived feature branches, a PR each, and
a squash-merge to `main`. My own default is the same — never commit straight to the
default branch.

The assignment says otherwise, explicitly:

> "Commit the logs as you go, interleaved with the code they produced, not in one dump
> at the end. **The commit order shows the order you actually worked in.**"

That sentence makes the commit graph part of the submission. Squash-merging destroys
exactly the signal being graded: it collapses the interleaving of logs and code, and
it replaces the order you actually worked in with the order you happened to merge in.
A branch-and-squash workflow would produce a tidier history that is *worse* at the one
job this history has.

**Decision: trunk-based. Commit directly to `main`. No squashing, no rebasing, no
history rewriting, ever.** This is a deliberate deviation from what I'd do on a team,
made because the grading criteria invert the usual trade-off. Reasons, in order:

1. The commit graph is a deliverable, not a by-product.
2. It's a solo build in a 12-hour window. There's no reviewer to gate on, so PR
   overhead buys nothing and costs context switches.
3. Vercel deploys `main`. Doc 11 requires "deploy at H1, every commit deploys" — that
   only works if `main` is the working branch and is always deployable.
4. A messy honest history scores better than a clean one. The brief says so directly.

**Flagging it because it overrides a safe default:** I will be committing and pushing
to `main` throughout. Say the word if you'd rather I work on a branch and merge with
`--no-ff` at each checkpoint — that preserves order too, at the cost of a noisier
graph.

---

## Branch model

```
main ──●──●──●──●──●──●──●──●──●──●──●──● (tagged: submission)
        │        └ spike/fal-provider ──●──●──┘   merged --no-ff
        └ H0 capture gate
```

One long-lived branch. The **only** reason to cut another is a spike that might be
abandoned — trying a provider integration that may not pan out, say.

- Spike works → merge with `--no-ff` so the branch is visible in the graph rather
  than flattened into it.
- Spike is abandoned → **push the branch anyway and leave it.** The brief asks for
  dead ends to stay visible; an abandoned branch is the cleanest possible record of
  one. Do not delete it to tidy up.

**Branch protection is deliberately off.** With a team I'd require PR review and
passing CI on `main`. Here it would block the workflow that the brief asks for. Noted
as a conscious choice, not an oversight.

## Keeping `main` green without a PR gate

Committing straight to trunk means the safety has to move earlier. Three gates, ordered
by how fast they are:

| Gate | Runs | Checks | Budget |
|---|---|---|---|
| pre-commit (husky + lint-staged) | every commit | `tsc --noEmit`, eslint on staged files, gitleaks on staged diff | < 10s |
| pre-push | every push | `vitest run` (unit only) | < 30s |
| CI (Actions) | every push to `main` | typecheck, lint, unit, build, e2e (mock provider), axe, `pnpm audit` | < 4 min |

Tests are not in pre-commit. A 30-second wait on every commit at a checkpoint-per-hour
cadence is how people start passing `--no-verify`, and a gate that gets bypassed is
worse than no gate.

**When `main` breaks: fix forward.** A new commit, never a rewrite. `fix: worker lease
expiry off by a factor of 1000` is an honest entry in exactly the record the brief
wants, and reverting history to hide it would be the one genuinely dishonest thing
available in this workflow.

## Commit conventions

Conventional Commits, because the type prefix makes the history skimmable at a glance
— which matters when the history is being read as a narrative.

```
feat:     user-visible capability
fix:      corrects a defect
chore:    tooling, config, deps
docs:     the docs/ folder, README
refactor: behaviour-preserving change
test:     tests only
```

Body says **what and why**, never how — the diff covers how. Every commit ends with
the attribution trailer:

```
feat: generation pipeline — queue, worker, realtime, refunds

Transactional outbox so the credit debit, the generation row, and the
job cannot disagree. Worker claims with FOR UPDATE SKIP LOCKED so
overlapping cron ticks are correct rather than merely unlikely to collide.

Refund is transactional with the failure write and idempotent on
'refund:'+generation_id, so a duplicate webhook can't double-refund.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## How `.agent-logs/` interleaves — the part that's easy to get wrong

The capture hook appends to a **single file per session** continuously, as the session
runs. That has a consequence worth stating explicitly, because the naive mental model
is wrong:

> The same log file appears in many commits, growing each time. One log file does
> **not** map to one commit.

At checkpoint N, `git add -A` picks up the code written since checkpoint N−1 *and* the
log entries that produced it, because the hook has already written them. That
co-location is exactly what "interleaved with the code they produced" means, and it
happens for free provided every checkpoint commit stages the whole tree.

So the commit command at every checkpoint in [11](11-DELIVERY-PLAN.md) is:

```bash
git add -A && git commit -m "feat: ..." && git push
```

Not selective staging. Selective staging is how the logs drift out of sync with the
code and end up looking like the one-lump dump the brief warns against.

**Two rules that follow:**
- Never `git checkout`, `git restore`, or `git stash` a file under `.agent-logs/`.
  Reverting code is fine; reverting the record of having written it is not.
- If the working tree needs resetting, reset the source paths explicitly and leave
  `.agent-logs/` untouched.

## Cadence

One commit per checkpoint in [11](11-DELIVERY-PLAN.md) — roughly 14 across the build,
plus fixes. That's the right granularity: large enough that each commit is a coherent
unit of work, small enough that the ordering tells a story.

Every commit is pushed immediately. An unpushed commit at hour 11 is a commit that
doesn't exist if the laptop dies, and it also means production is behind the work.

## Repository contents

| Path | Committed | Note |
|---|---|---|
| `.agent-logs/*.md` | **yes** | never gitignored. the submission depends on it. |
| `.agent-logs/.index.json` | no | machine state, the one mutable thing in there |
| `.agent-logs/.capture-errors.log` | no | |
| `.claude/settings.json` | yes | the hook config is evidence |
| `CAPTURE-TEST.md` | yes | repo root, first thing opened |
| `docs/` | yes | this plan |
| `drizzle/` | yes | migrations are source |
| `supabase/policies/` | yes | RLS as committed SQL |
| `pnpm-lock.yaml` | yes | |
| `.env.example` | yes | placeholders + comments |
| `.env.local` | no | |
| `research/*.html` | yes | the teardown's raw evidence |

## Tags

At the final commit, before recording the walkthrough:

```bash
git tag -a submission -m "8x assignment submission" && git push --tags
```

So the reviewer can see exactly what was handed in even if commits land afterwards.
The live link keeps tracking `main`; the tag is the frozen reference.

## Pre-submission history audit

```bash
gitleaks detect --source . --log-opts="--all"   # full history, not just HEAD
git reflog --all | grep -i "force\|rebase" || echo "no history rewriting"
git log --oneline --stat | grep -c "agent-logs"  # want many commits, not one
git log --format='%h %ad %s' --date=short        # read it as a narrative
git log --diff-filter=D --name-only -- .agent-logs/  # must be empty
```

The last one matters most: it proves no log entry was ever deleted. Combined with no
force-pushes in the reflog, that's a verifiable claim that the record is unedited —
which is stronger than asserting it in a README.

## What I'd do with a team

Stated so the trunk-based choice reads as a judgement rather than a shortcut:
short-lived branches off `main`, PR with required review and green CI, squash-merge
to keep `main` linear, branch protection with no direct pushes, CODEOWNERS on
`services/credits/` and anything touching RLS, and release tags per deploy. Every one
of those is right on a team and wrong for this specific submission, for the reasons at
the top.
