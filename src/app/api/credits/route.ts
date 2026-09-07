import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase, hasTestBypass } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { spentFrom } from "@/services/credits/meter";
import { readCreditsAccount, refundCreditsAccount } from "@/services/credits/spend";

const refundSchema = z.object({
  amount: z.number().int().positive().max(80),
});

export async function GET() {
  if ((await hasTestBypass()) || !supabaseConfigured()) {
    return NextResponse.json({ local: true });
  }
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ local: true });
  const row = await readCreditsAccount(supabase);
  if (!row) return NextResponse.json({ error: "Sign in to see credits." }, { status: 401 });
  return NextResponse.json({
    balance: row.balance,
    spent: spentFrom(row.balance),
  });
}

export async function POST(req: Request) {
  if ((await hasTestBypass()) || !supabaseConfigured()) {
    return NextResponse.json({ local: true });
  }
  const parsed = refundSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Refund amount is required." }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  const balance = await refundCreditsAccount(supabase, parsed.data.amount);
  if (balance == null) {
    return NextResponse.json({ error: "Sign in to refund credits." }, { status: 401 });
  }
  return NextResponse.json({ balance, spent: spentFrom(balance) });
}
