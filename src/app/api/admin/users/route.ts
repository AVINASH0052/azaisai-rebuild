import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoAdminEmail } from "@/lib/auth/demo-admin";
import { getPlatformAdmin } from "@/lib/auth/platform-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { creditsFromMeta } from "@/services/credits/meter";
import {
  serviceUserFromParts,
  usageFromMeta,
  writeAppUser,
  type ServiceUser,
} from "@/services/users/app-users";

const patchSchema = z.object({
  userId: z.string().uuid(),
  credits: z.number().int().min(0).max(10_000).optional(),
  banned: z.boolean().optional(),
});

async function requireAdmin() {
  const supabase = await createServerSupabase();
  if (!supabase) return { supabase: null, user: null, admin: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = await getPlatformAdmin(supabase, user?.id, user);
  return { supabase, user, admin };
}

function sortUsers(users: ServiceUser[]) {
  return users.sort((a, b) => Number(b.admin) - Number(a.admin) || a.email.localeCompare(b.email));
}

function mergeUser(into: Map<string, ServiceUser>, next: ServiceUser) {
  const cur = into.get(next.id);
  into.set(next.id, {
    ...cur,
    ...next,
    generations: Math.max(cur?.generations ?? 0, next.generations),
    creditsSpent: Math.max(cur?.creditsSpent ?? 0, next.creditsSpent),
    banned: Boolean(cur?.banned || next.banned),
    lastGeneratedAt: next.lastGeneratedAt ?? cur?.lastGeneratedAt ?? null,
    createdAt: cur?.createdAt ?? next.createdAt,
  });
}

export async function GET() {
  const { supabase, user, admin } = await requireAdmin();
  if (!supabase || !user || !admin) {
    return NextResponse.json({ error: "Admin only." }, { status: 404 });
  }

  const byId = new Map<string, ServiceUser>();

  const gotrue = createAdminSupabase();
  const [rpc, appUsers, listed] = await Promise.all([
    supabase.rpc("list_hearth_users"),
    supabase
      .from("app_users")
      .select("user_id, email, credits, created_at, banned, generations, credits_spent, last_generated_at"),
    gotrue
      ? gotrue.auth.admin.listUsers({ page: 1, perPage: 200 })
      : Promise.resolve(null),
  ]);
  if (!rpc.error && Array.isArray(rpc.data)) {
    for (const r of rpc.data as Record<string, unknown>[]) {
      mergeUser(
        byId,
        serviceUserFromParts({
          id: String(r.user_id),
          email: String(r.email ?? ""),
          credits: Number(r.credits) || 0,
          createdAt: (r.created_at as string | null) ?? null,
          lastGeneratedAt: (r.last_generated_at as string | null) ?? null,
          generations: Number(r.generations) || 0,
          creditsSpent: Number(r.credits_spent) || 0,
          banned: Boolean(r.banned),
        }),
      );
    }
  }

  for (const r of appUsers.data ?? []) {
    mergeUser(
      byId,
      serviceUserFromParts({
        id: r.user_id as string,
        email: (r.email as string) ?? "",
        credits: Number(r.credits) || 0,
        createdAt: (r.created_at as string | null) ?? null,
        lastGeneratedAt: (r.last_generated_at as string | null) ?? null,
        generations: Number(r.generations) || 0,
        creditsSpent: Number(r.credits_spent) || 0,
        banned: Boolean(r.banned),
      }),
    );
  }

  if (listed?.data?.users) {
    for (const u of listed.data.users) {
      const usage = usageFromMeta(u.user_metadata);
      mergeUser(
        byId,
        serviceUserFromParts({
          id: u.id,
          email: u.email ?? "",
          credits: creditsFromMeta(u.user_metadata),
          createdAt: u.created_at ?? null,
          lastGeneratedAt: usage.lastGeneratedAt,
          generations: usage.generations,
          creditsSpent: usage.creditsSpent,
          banned: usage.banned,
        }),
      );
    }
  }

  if (!byId.size) byId.set(user.id, {
    ...serviceUserFromParts({
      id: user.id,
      email: user.email ?? "",
      credits: creditsFromMeta(user.user_metadata),
      createdAt: user.created_at ?? null,
      ...usageFromMeta(user.user_metadata),
      banned: false,
    }),
  });

  return NextResponse.json({ users: sortUsers([...byId.values()]) });
}

export async function PATCH(req: Request) {
  const { supabase, user, admin } = await requireAdmin();
  if (!supabase || !user || !admin) {
    return NextResponse.json({ error: "Admin only." }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "User and a change are required." }, { status: 400 });
  }
  const { userId, credits, banned } = parsed.data;
  if (credits == null && banned == null) {
    return NextResponse.json({ error: "Assign credits or change the ban." }, { status: 400 });
  }

  const gotrue = createAdminSupabase();
  const listed = gotrue
    ? await gotrue.auth.admin.getUserById(userId)
    : null;
  const targetEmail =
    listed?.data.user?.email ??
    (userId === user.id ? user.email : null);
  if (banned && isDemoAdminEmail(targetEmail)) {
    return NextResponse.json({ error: "The Hearth admin account cannot be banned." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (credits != null) patch.credits = credits;
  if (banned != null) patch.banned = banned;
  await writeAppUser(supabase, userId, patch);

  const meta: Record<string, unknown> = {};
  if (credits != null) meta.credits = credits;
  if (banned != null) meta.banned = banned;
  if (gotrue) {
    const current = listed?.data.user?.user_metadata ?? {};
    await gotrue.auth.admin.updateUserById(userId, {
      user_metadata: { ...current, ...meta },
    });
  } else if (userId === user.id) {
    await supabase.auth.updateUser({ data: meta });
  }
  return NextResponse.json({ ok: true, credits, banned });
}
