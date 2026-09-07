import { desc, eq } from "drizzle-orm";
import { creditLedger } from "@/db/schema";
import { requireDb } from "@/db";
import { TEST_BYPASS_CREDITS } from "@/lib/auth/test-bypass";
import { createServerSupabase, hasTestBypass } from "@/lib/supabase/server";

export async function balance(workspaceId: string) {
  const db = requireDb();
  const rows = await db
    .select({ balanceAfter: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.workspaceId, workspaceId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(1);
  return rows[0]?.balanceAfter ?? 0;
}

export async function sessionBalance() {
  if (await hasTestBypass()) {
    return { balance: TEST_BYPASS_CREDITS, workspaceId: null as string | null };
  }
  const supabase = await createServerSupabase();
  if (!supabase) return { balance: 0, workspaceId: null as string | null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { balance: 0, workspaceId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const workspaceId = profile?.default_workspace_id as string | null;
  if (!workspaceId) return { balance: 0, workspaceId: null };

  const { data } = await supabase
    .from("credit_ledger")
    .select("balance_after")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1);
  return { balance: data?.[0]?.balance_after ?? 0, workspaceId };
}
