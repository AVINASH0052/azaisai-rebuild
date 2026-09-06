import { createServerSupabase } from "@/lib/supabase/server";
import { sessionBalance } from "@/services/credits";

export default async function CreditsPage() {
  const { balance, workspaceId } = await sessionBalance();
  const supabase = await createServerSupabase();
  const { data: rows } = workspaceId && supabase
    ? await supabase
        .from("credit_ledger")
        .select("id, amount, reason, balance_after, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <main className="p-6">
      <div className="rounded-3xl border border-border bg-bg-elevated px-6 py-10 shadow-card">
        <h1 className="text-3xl text-fg">Credits</h1>
        <p className="mt-3 font-mono text-4xl text-fg">{balance}</p>
        <p className="mt-1 text-sm text-fg-muted">
          Running balance from the ledger.
        </p>
        <ul className="mt-8 divide-y divide-border">
          {(rows ?? []).map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span className="text-fg-muted">
                {row.reason.replaceAll("_", " ")}
              </span>
              <span className="font-mono">
                {row.amount > 0 ? "+" : ""}
                {row.amount}
                <span className="ml-3 text-fg-subtle">{row.balance_after}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
