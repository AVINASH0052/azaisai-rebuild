# 13 — Submission Checklist

## The three deliverables

| Field | Content |
|---|---|
| **Walkthrough** | Loom link. Camera on. Under 5:00. |
| **Links** | Two, each labelled: `Live: https://<domain>` and `Repo: https://github.com/<user>/<repo>` |

## Hard gates

Verified in order, each in a way that can actually fail.

### Live link
- [ ] Opens in a **fresh incognito window** with no session — not "should work", checked
- [ ] Landing renders with real seeded gallery content, not empty states
- [ ] Sign-up works for a brand-new email address, end to end
- [ ] A new account can generate something and download it, with zero manual setup
- [ ] `/g/<shareId>` public share page renders for a logged-out visitor
- [ ] Custom domain, HTTPS, no certificate warning
- [ ] Checked on a phone, not just a narrowed desktop window

### Repository
- [ ] **Public** — verified by loading it in a logged-out browser, not by the settings toggle
- [ ] `.agent-logs/` present and browsable on github.com
- [ ] `.agent-logs/` is **not** in `.gitignore`
- [ ] Log entries are unedited: no cleanup, no deletions, dead ends left in
- [ ] Commits are interleaved with the code they produced — not one dump at the end
- [ ] `CAPTURE-TEST.md` at repo root with both canaries pasted raw and anything that
      failed first
- [ ] README: what it is, live link, architecture diagram, local setup, env vars,
      what was cut and why, honest known limitations
- [ ] No secrets anywhere in the history (`gitleaks detect` on the full history, not
      just the working tree)
- [ ] No history rewriting — reflog shows no force-push or rebase
      ([15](15-GIT-WORKFLOW.md))
- [ ] `git log --diff-filter=D -- .agent-logs/` is **empty** — proves no log entry was
      ever deleted
- [ ] `submission` tag pushed at the final commit
- [ ] `.env.example` present with placeholders

### Walkthrough
- [ ] Camera on and visible for the whole recording
- [ ] Under 5:00
- [ ] Follows the beat script in [11](11-DELIVERY-PLAN.md)
- [ ] Shows the **live deployed URL**, not localhost
- [ ] States clearly what was cut and why — this is what "product judgement" is scored on
- [ ] Audio audible; screen text legible at the recorded resolution
- [ ] Link sharing set to public — opened in an incognito window to confirm

## Pre-flight (H11.5)

```bash
gitleaks detect --source . --log-opts="--all"   # full history
grep -rn "SERVICE_ROLE\|sk_live\|fal_" .agent-logs/ || echo "clean"
git ls-files .agent-logs | wc -l                 # > 0
grep -c "agent-logs" .gitignore                  # 0 for the directory itself
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm e2e                                         # happy path green
curl -s https://<domain>/api/health | jq         # all checks ok, version = HEAD sha
```

Then, manually, in incognito: land → sign up with a fresh email → generate → download
→ share → open the share link in a second incognito window.

## What the reviewer sees, in the order they'll look

1. **`CAPTURE-TEST.md`** — explicitly "the first thing we open." It has to be green
   and honest.
2. **The live link** — signed out, on whatever device is in front of them.
3. **The walkthrough** — five minutes deciding whether the judgement was sound.
4. **`.agent-logs/`** — how the work was actually done, dead ends included.
5. **The code** — schema, the credit service, the provider abstraction.

Everything in this plan is arranged so those five hold up in that order.

## Known limitations to state openly

Being straight about these is worth more than hoping they aren't noticed:

- Stripe runs in **test mode**; test card numbers are documented on the pricing page.
- Video generation is limited to fast/cheap models under a daily spend ceiling; beyond
  the ceiling the app degrades to the mock provider with a visible badge.
- Teams, RBAC UI, API-key management, webhooks-out, i18n beyond `en`, and multi-currency
  checkout have **schema and interfaces but no UI** — deliberate, documented in
  [02](02-SCOPE.md) Tier 2.
- The original's authenticated screens (`/history`, `/credits`, `/profile`,
  `/admin/*`, `/reposter`) were never observed signed in; their structure was derived
  from the shipped client bundle. Our versions are designed from the loop, not copied.
- The reposter program, referrals, and ten of eleven admin routes are not built, by
  choice, with reasons in [02](02-SCOPE.md) Tier 3.
