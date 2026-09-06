# AzaisAI rebuild

Rebuild of [azaisai.com](https://azaisai.com) for the 8x engineering assignment.

Live: https://azaisai-rebuild.vercel.app  
Repo: https://github.com/AVINASH0052/azaisai-rebuild  
Author: Avinash 0052 (`AVINASH0052`).

Planning (written before application code): [`docs/`](docs/).
Agent capture proof: [`CAPTURE-TEST.md`](CAPTURE-TEST.md).

```bash
pnpm install
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL
pnpm db:apply
pnpm dev
```

Apply `drizzle/0000_init.sql` then `supabase/policies/rls.sql` against the Supabase Postgres database (needs `auth.users`). Enable email OTP in the Auth providers panel.
