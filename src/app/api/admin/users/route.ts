import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoAdminEmail } from "@/lib/auth/demo-admin";
import { getPlatformAdmin } from "@/lib/auth/platform-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { creditsFromMeta } from "@/services/credits/meter";
import { writeAppUserCredits, type ServiceUser } from "@/services/users/app-users";

const patchSchema = z.object({
  userId: z.string().uuid(),
  credits: z.number().int().min(0).max(10_000),
});

async function requireAdmin() {
  const supabase = await createServerSupabase();
  if (!supabase) return { supabase: null, user: null, admin: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = await getPlatformAdmin(supabase, user?.id);
  return { supabase, user, admin };
}

function sortUsers(users: ServiceUser[]) {
  return users.sort((a, b) => Number(b.admin) - Number(a.admin) || a.email.localeCompare(b.email));
}

export async function GET() {
  const { supabase, user, admin } = await requireAdmin();
  if (!supabase || !user || !admin) {
    return NextResponse.json({ error: "Admin only." }, { status: 404 });
  }

  const { data: rows } = await supabase
    .from("app_users")
    .select("user_id, email, credits, created_at");
  const fromTable: ServiceUser[] = (rows ?? []).map((r) => ({
    id: r.user_id as string,
    email: (r.email as string) ?? "",
    credits: Number(r.credits) || 0,
    createdAt: (r.created_at as string | null) ?? null,
    admin: isDemoAdminEmail(r.email as string),
  }));

  const gotrue = createAdminSupabase();
  if (gotrue) {
    const listed = await gotrue.auth.admin.listUsers({ page: 1, perPage: 200 });
    const byId = new Map(fromTable.map((u) => [u.id, u]));
    for (const u of listed.data.users) {
      const existing = byId.get(u.id);
      byId.set(u.id, {
        id: u.id,
        email: u.email ?? existing?.email ?? "",
        credits: existing?.credits ?? creditsFromMeta(u.user_metadata),
        createdAt: u.created_at ?? existing?.createdAt ?? null,
        admin: isDemoAdminEmail(u.email),
      });
    }
    return NextResponse.json({ users: sortUsers([...byId.values()]) });
  }

  if (fromTable.length) return NextResponse.json({ users: sortUsers(fromTable) });
  return NextResponse.json({
    users: [
      {
        id: user.id,
        email: user.email ?? "",
        credits: creditsFromMeta(user.user_metadata),
        createdAt: user.created_at ?? null,
        admin: true,
      } satisfies ServiceUser,
    ],
  });
}

export async function PATCH(req: Request) {
  const { supabase, user, admin } = await requireAdmin();
  if (!supabase || !user || !admin) {
    return NextResponse.json({ error: "Admin only." }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "User and credits are required." }, { status: 400 });
  }
  const credits = Math.min(10_000, Math.max(0, parsed.data.credits));
  await writeAppUserCredits(supabase, parsed.data.userId, credits);
  const gotrue = createAdminSupabase();
  if (gotrue) {
    await gotrue.auth.admin.updateUserById(parsed.data.userId, {
      user_metadata: { credits },
    });
  } else if (parsed.data.userId === user.id) {
    await supabase.auth.updateUser({ data: { credits } });
  }
  return NextResponse.json({ ok: true, credits });
}
