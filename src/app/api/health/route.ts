import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { env } from "@/lib/env";
import { requestId } from "@/lib/request-id";
import { supabaseConfigured } from "@/lib/supabase/config";

type Check = "ok" | "unconfigured" | "error";

function check(configured: boolean): { status: Check } {
  return { status: configured ? "ok" : "unconfigured" };
}

async function dbCheck(): Promise<{ status: Check }> {
  if (!env.DATABASE_URL) return { status: "unconfigured" };
  try {
    const db = createDb();
    if (!db) return { status: "unconfigured" };
    await db.execute(sql`select 1`);
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
}

export async function GET(req: Request) {
  const id = requestId(req.headers.get("x-request-id"));
  const checks = {
    db: await dbCheck(),
    storage: check(supabaseConfigured()),
    provider: check(env.PROVIDER_MODE === "mock" || Boolean(env.FAL_KEY)),
    llm: check(Boolean(env.GOOGLE_AI_STUDIO)),
    stripe: check(Boolean(env.STRIPE_SECRET_KEY)),
  };
  const body = {
    status: "ok" as const,
    checks,
    version: env.NEXT_PUBLIC_GIT_SHA,
    provider_mode: env.PROVIDER_MODE,
  };
  return NextResponse.json(body, {
    headers: { "X-Request-Id": id },
  });
}
