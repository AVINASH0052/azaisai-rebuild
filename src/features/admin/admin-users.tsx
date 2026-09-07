"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ServiceUser } from "@/services/users/app-users";

const field =
  "w-24 rounded-xl border border-border bg-bg px-2 py-1.5 font-mono text-sm text-fg shadow-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

function joinedLabel(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminUsers() {
  const [users, setUsers] = useState<ServiceUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/users");
    const json = (await res.json()) as { users?: ServiceUser[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not load users.");
      return;
    }
    setUsers(json.users ?? []);
    setDrafts(
      Object.fromEntries((json.users ?? []).map((u) => [u.id, String(u.credits)])),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(user: ServiceUser) {
    const credits = Number(drafts[user.id]);
    if (!Number.isFinite(credits)) {
      setError("Credits must be a number.");
      return;
    }
    setSaving(user.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: user.id, credits: Math.floor(credits) }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not update credits.");
        return;
      }
      await load();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-fg-muted">
        {users.filter((u) => !u.admin).length} people using the service.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {users.length === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">No accounts yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-fg">
                  {user.email || "Unknown"}
                  {user.admin ? (
                    <span className="ml-2 font-mono text-[10px] tracking-wide text-accent uppercase">
                      admin
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-fg-subtle">
                  Joined {joinedLabel(user.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className={field}
                  type="number"
                  min={0}
                  max={10000}
                  value={drafts[user.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((cur) => ({ ...cur, [user.id]: e.target.value }))
                  }
                />
                <span className="text-xs text-fg-muted">cr</span>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving === user.id}
                  onClick={() => void save(user)}
                >
                  {saving === user.id ? "Saving…" : "Save"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
