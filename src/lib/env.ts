import { z } from "zod";

const emptyToUndef = (v: unknown) =>
  v === "" || v === undefined || v === null ? undefined : v;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_GIT_SHA: z.string().default("dev"),
  PROVIDER_MODE: z.enum(["mock", "auto", "live"]).default("mock"),
  DATABASE_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  FAL_KEY: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  STRIPE_SECRET_KEY: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  STRIPE_PUBLISHABLE_KEY: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  CRON_SECRET: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  SENTRY_DSN: z.preprocess(emptyToUndef, z.string().url().optional()),
});

export const env = schema.parse({
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_GIT_SHA:
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA,
  PROVIDER_MODE: process.env.PROVIDER_MODE,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FAL_KEY: process.env.FAL_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  SENTRY_DSN: process.env.SENTRY_DSN,
});

export type Env = z.infer<typeof schema>;
