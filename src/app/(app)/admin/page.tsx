export default function AdminPage() {
  return (
    <main className="p-6">
      <div className="rounded-3xl border border-border bg-bg-elevated px-6 py-14 shadow-card">
        <h1 className="text-3xl text-fg">Control plane</h1>
        <p className="mt-2 max-w-xl text-fg-muted">
          Limits editor, workspace list, and spend clamps land next. This route
          404s for anyone who is not in{" "}
          <code className="font-mono text-sm">platform_admins</code>.
        </p>
      </div>
    </main>
  );
}
