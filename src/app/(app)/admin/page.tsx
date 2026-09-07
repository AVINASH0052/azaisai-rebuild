import { AdminUsers } from "@/features/admin/admin-users";

export default function AdminPage() {
  return (
    <main className="p-6">
      <div className="rounded-3xl border border-border bg-bg-elevated px-6 py-10 shadow-card">
        <h1 className="text-3xl text-fg">Control plane</h1>
        <p className="mt-2 max-w-xl text-fg-muted">
          Accounts using Hearth. Change credits and they apply on that
          user&apos;s next generate.
        </p>
        <AdminUsers />
      </div>
    </main>
  );
}
