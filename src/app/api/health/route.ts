import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requestId } from "@/lib/request-id";

type Check = "ok" | "unconfigured";

function check(configured: boolean): { status: Check } {
  return { status: configured ? "ok" : "unconfigured" };
}

export async function GET(req: Request) {
  const id = requestId(req.headers.get("x-request-id"));
  const checks = {
    db: check(Boolean(env.DATABASE_URL)),
    storage: check(Boolean(env.NEXT_PUBLIC_SUPABASE_URL)),
    provider: check(env.PROVIDER_MODE === "mock" || Boolean(env.FAL_KEY)),
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
