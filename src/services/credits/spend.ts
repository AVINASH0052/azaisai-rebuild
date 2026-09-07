import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import {
  creditsFromAppUser,
  isUserBanned,
  usageAfterSpend,
  writeAppUser,
} from "@/services/users/app-users";
import {
  STARTING_CREDITS,
  creditsFromMeta,
  refundTo,
  spendFrom,
} from "./meter";

type AuthClient = SupabaseClient;

async function userOf(supabase: AuthClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function readCreditsAccount(supabase: AuthClient) {
  const user = await userOf(supabase);
  if (!user) return null;
  const fromRow = await creditsFromAppUser(supabase, user.id);
  const balance = fromRow ?? creditsFromMeta(user.user_metadata);
  if (user.user_metadata?.credits == null) {
    await supabase.auth.updateUser({ data: { credits: STARTING_CREDITS } });
  }
  return { user, balance };
}

export async function spendCredits(supabase: AuthClient, cost: number) {
  const row = await readCreditsAccount(supabase);
  if (!row) throw new AppError("UNAUTHENTICATED", "Sign in to generate.");
  if (await isUserBanned(supabase, row.user)) {
    throw new AppError("ACCOUNT_SUSPENDED", "This Hearth account is banned.");
  }
  const next = spendFrom(row.balance, cost);
  if (!next.ok) {
    throw new AppError("INSUFFICIENT_CREDITS", "Not enough credits for this generation.", {
      balance: row.balance,
      cost,
    });
  }
  const usage = usageAfterSpend(row.user.user_metadata, next.charged);
  const { error } = await supabase.auth.updateUser({
    data: { credits: next.balance, ...usage },
  });
  if (error) throw new AppError("INTERNAL", "Could not update credits.");
  await writeAppUser(supabase, row.user.id, {
    credits: next.balance,
    generations: usage.generations,
    credits_spent: usage.credits_spent,
    last_generated_at: usage.last_generated_at,
  });
  return next.balance;
}

export async function refundCreditsAccount(supabase: AuthClient, cost: number) {
  const row = await readCreditsAccount(supabase);
  if (!row) return null;
  const balance = refundTo(row.balance, cost);
  const { error } = await supabase.auth.updateUser({ data: { credits: balance } });
  if (error) return row.balance;
  await writeAppUser(supabase, row.user.id, { credits: balance });
  return balance;
}
