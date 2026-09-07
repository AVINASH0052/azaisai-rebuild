import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isDemoAdminEmail } from "@/lib/auth/demo-admin";
import { creditsFromMeta } from "@/services/credits/meter";

export type ServiceUser = {
  id: string;
  email: string;
  credits: number;
  createdAt: string | null;
  lastGeneratedAt: string | null;
  generations: number;
  creditsSpent: number;
  banned: boolean;
  admin: boolean;
};

export type UsageMeta = {
  credits?: unknown;
  banned?: unknown;
  generations?: unknown;
  credits_spent?: unknown;
  last_generated_at?: unknown;
};

export function isBannedMeta(meta: UsageMeta | null | undefined) {
  return meta?.banned === true || meta?.banned === "true";
}

export function usageFromMeta(meta: UsageMeta | null | undefined) {
  return {
    generations: Math.max(0, Math.floor(Number(meta?.generations) || 0)),
    creditsSpent: Math.max(0, Math.floor(Number(meta?.credits_spent) || 0)),
    lastGeneratedAt:
      typeof meta?.last_generated_at === "string" ? meta.last_generated_at : null,
    banned: isBannedMeta(meta),
  };
}

export function usageAfterSpend(meta: UsageMeta | null | undefined, cost: number) {
  const cur = usageFromMeta(meta);
  const spent = Math.max(0, Math.floor(cost));
  return {
    generations: cur.generations + 1,
    credits_spent: cur.creditsSpent + spent,
    last_generated_at: new Date().toISOString(),
  };
}

export function serviceUserFromParts(opts: {
  id: string;
  email: string;
  credits: number;
  createdAt: string | null;
  lastGeneratedAt?: string | null;
  generations?: number;
  creditsSpent?: number;
  banned?: boolean;
}): ServiceUser {
  return {
    id: opts.id,
    email: opts.email,
    credits: opts.credits,
    createdAt: opts.createdAt,
    lastGeneratedAt: opts.lastGeneratedAt ?? null,
    generations: opts.generations ?? 0,
    creditsSpent: opts.creditsSpent ?? 0,
    banned: Boolean(opts.banned),
    admin: isDemoAdminEmail(opts.email),
  };
}

export async function touchAppUser(supabase: SupabaseClient, user: User) {
  const credits = creditsFromMeta(user.user_metadata);
  const usage = usageFromMeta(user.user_metadata);
  await supabase.from("app_users").upsert(
    {
      user_id: user.id,
      email: user.email ?? "",
      credits,
      banned: usage.banned,
      generations: usage.generations,
      credits_spent: usage.creditsSpent,
    },
    { onConflict: "user_id" },
  );
}

export async function readAppUserRow(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("app_users")
    .select("credits, banned, generations, credits_spent, last_generated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function creditsFromAppUser(
  supabase: SupabaseClient,
  userId: string,
) {
  const row = await readAppUserRow(supabase, userId);
  if (row?.credits == null) return null;
  const n = Number(row.credits);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export async function isUserBanned(supabase: SupabaseClient, user: User) {
  if (isDemoAdminEmail(user.email)) return false;
  const row = await readAppUserRow(supabase, user.id);
  if (row?.banned === true) return true;
  return isBannedMeta(user.user_metadata);
}

export async function writeAppUser(
  supabase: SupabaseClient,
  userId: string,
  patch: Record<string, unknown>,
) {
  await supabase
    .from("app_users")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function writeAppUserCredits(
  supabase: SupabaseClient,
  userId: string,
  credits: number,
) {
  await writeAppUser(supabase, userId, { credits });
}

export function userFromAuth(user: User): ServiceUser {
  const usage = usageFromMeta(user.user_metadata);
  return serviceUserFromParts({
    id: user.id,
    email: user.email ?? "",
    credits: creditsFromMeta(user.user_metadata),
    createdAt: user.created_at ?? null,
    lastGeneratedAt: usage.lastGeneratedAt,
    generations: usage.generations,
    creditsSpent: usage.creditsSpent,
    banned: usage.banned,
  });
}
