import { AdminUsers } from "@/features/admin/admin-users";
import { BRAND } from "@/lib/brand";

export default function AdminPage() {
  return (
    <main className="p-6">
      <div className="rounded-3xl border border-border bg-bg-elevated px-6 py-10 shadow-card">
        <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
          {BRAND}
        </p>
        <h1 className="mt-1 text-3xl text-fg">Admin</h1>
        <p className="mt-2 max-w-xl text-fg-muted">
          Track usage on {BRAND}, assign credits, or ban an account so it
          cannot generate.
        </p>
        <AdminUsers />
      </div>
    </main>
  );
}
