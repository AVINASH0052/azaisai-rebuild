"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
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

  async function patch(user: ServiceUser, body: { credits?: number; banned?: boolean }) {
    setSaving(user.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...body }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not update that account.");
        return;
      }
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function saveCredits(user: ServiceUser) {
    const credits = Number(drafts[user.id]);
    if (!Number.isFinite(credits)) {
      setError("Credits must be a number.");
      return;
    }
    await patch(user, { credits: Math.floor(credits) });
  }

  const customers = users.filter((u) => !u.admin);
  const banned = customers.filter((u) => u.banned).length;
  const used = customers.reduce((n, u) => n + u.generations, 0);

  return (
    <div className="mt-6">
      <p className="text-sm text-fg-muted">
        {customers.length} using {BRAND}
        {used ? ` · ${used} generations` : ""}
        {banned ? ` · ${banned} banned` : ""}
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {users.length === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">No accounts yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p className="text-sm text-fg">
                  {user.email || "Unknown"}
                  {user.admin ? (
                    <span className="ml-2 font-mono text-[10px] tracking-wide text-accent uppercase">
                      admin
                    </span>
                  ) : null}
                  {user.banned ? (
                    <span className="ml-2 font-mono text-[10px] tracking-wide text-danger uppercase">
                      banned
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-fg-subtle">
                  Joined {joinedLabel(user.createdAt)}
                  {" · "}
                  {user.generations} gen
                  {" · "}
                  {user.creditsSpent} cr used
                  {user.lastGeneratedAt
                    ? ` · last ${joinedLabel(user.lastGeneratedAt)}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => void saveCredits(user)}
                >
                  {saving === user.id ? "Saving…" : "Assign"}
                </Button>
                {user.admin ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant={user.banned ? "outline" : "destructive"}
                    disabled={saving === user.id}
                    onClick={() => void patch(user, { banned: !user.banned })}
                  >
                    {user.banned ? "Unban" : "Ban"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
