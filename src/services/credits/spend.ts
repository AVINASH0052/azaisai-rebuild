import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
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
  const balance = creditsFromMeta(user.user_metadata);
  if (user.user_metadata?.credits == null) {
    await supabase.auth.updateUser({ data: { credits: STARTING_CREDITS } });
  }
  return { user, balance };
}

export async function spendCredits(supabase: AuthClient, cost: number) {
  const row = await readCreditsAccount(supabase);
  if (!row) throw new AppError("UNAUTHENTICATED", "Sign in to generate.");
  const next = spendFrom(row.balance, cost);
  if (!next.ok) {
    throw new AppError("INSUFFICIENT_CREDITS", "Not enough credits for this generation.", {
      balance: row.balance,
      cost,
    });
  }
  const { error } = await supabase.auth.updateUser({ data: { credits: next.balance } });
  if (error) throw new AppError("INTERNAL", "Could not update credits.");
  return next.balance;
}

export async function refundCreditsAccount(supabase: AuthClient, cost: number) {
  const row = await readCreditsAccount(supabase);
  if (!row) return null;
  const balance = refundTo(row.balance, cost);
  const { error } = await supabase.auth.updateUser({ data: { credits: balance } });
  if (error) return row.balance;
  return balance;
}
