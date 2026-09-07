# Hearth

12-hour rebuild of [azaisai.com](https://azaisai.com) for the 8x engineering assignment.

A credit-metered studio for Google Veo (video) and Gemini (image). Sign in, generate, download, and an admin plane to assign credits or ban accounts.

| | |
|---|---|
| **Live** | https://azaisai-rebuild.vercel.app |
| **Repo** | https://github.com/AVINASH0052/azaisai-rebuild |
| **Author** | Avinash 0052 (`AVINASH0052`) |
| **Capture** | [`CAPTURE-TEST.md`](CAPTURE-TEST.md) · [`.agent-logs/`](.agent-logs/) |

Planning written before application code: [`docs/`](docs/).

## What shipped

- Email + password auth (signup, sign-in, reset)
- Video and image studio: Veo / Gemini, aspect, length, live credit cost
- Prompt enhance, storyboard / stitch for clips longer than one Veo take
- Download, per-account credit meter (80 on signup)
- History and credits pages (browser-local for this window)
- Admin: list users, assign credits, ban (`admin@hearth.com`)
- Agent capture hooks from the first commit, logs committed as work happened

## Architecture

```
Browser  →  Next.js on Vercel (UI + API routes)
                 │
                 ├─ Supabase Auth + Postgres (accounts, RLS, app_users)
                 └─ Google AI Studio (Veo, Gemini)
```

There is no separate API server, worker, or realtime channel. Generate, auth, and admin all run as Vercel serverless functions talking to Supabase and Google.

## What I left out (on purpose)

The original's orbit — Stripe, referrals, reposter, six locales, eleven admin analytics routes, phone-OTP wall, three analytics vendors — is not the loop. I rebuilt sign-in → generate → download first, then a small admin control plane. Schema seams for workspaces, a ledger, and share IDs exist; the screens do not.

## Known limitations

Be straight: this is a 12-hour slice, not a production backend.

- **Vercel only.** No custom domain. Serverless cold starts make login and the first generate slow (often several seconds). That is the host, not a missing spinner.
- **No dedicated backend.** No Cloud Run worker, no job queue consumer, no `DATABASE_URL` on the live deploy. Long work shares the same Next.js request as the browser.
- **No realtime.** Progress is request/response, not WebSocket / Supabase Realtime. Refresh to see a finished job.
- **History and the credits “ledger” are localStorage**, scoped to the signed-in account on that browser. A new device looks empty.
- **No public share page** (`/g/<id>` 404s).
- **Confirm-email is off.** The free Supabase mailer hit rate limits; accounts are usable without a confirmation link.
- **Health** reports `db`, `worker`, and `stripe` as unconfigured. Provider and LLM are live (`provider_mode: auto`).
- **More can be added** on the same stack: a worker for stitch, a real credit ledger, share permalinks, Stripe test checkout, and Realtime progress. Those were time cuts, not dead ends.

## Local setup

```bash
pnpm install
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, GOOGLE_AI_STUDIO
pnpm dev
```

Optional: apply `supabase/app-users.sql` in the Supabase SQL editor so admin can list every Auth user. Set `AUTH_ADMIN_PASSWORD` (defaults to `hearth-admin`) for `admin@hearth.com`.

Do not commit `.env.local`. Placeholders live in `.env.example`.

## Checks

```bash
pnpm typecheck
pnpm quote:test
pnpm capture:test
curl -s https://azaisai-rebuild.vercel.app/api/health
```
