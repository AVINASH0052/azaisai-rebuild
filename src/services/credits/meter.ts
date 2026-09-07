export const STARTING_CREDITS = 80;

export function creditsFromMeta(meta: unknown) {
  const n = Number((meta as { credits?: unknown } | null | undefined)?.credits);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : STARTING_CREDITS;
}

export function spendFrom(balance: number, cost: number) {
  const c = Math.max(0, Math.floor(cost));
  if (c <= 0) return { ok: true as const, balance, charged: 0 };
  if (balance < c) return { ok: false as const, balance, charged: 0 };
  return { ok: true as const, balance: balance - c, charged: c };
}

export function refundTo(balance: number, cost: number) {
  const c = Math.max(0, Math.floor(cost));
  // ponytail: cap at the signup grant; replace when top-ups exist
  return Math.min(STARTING_CREDITS, balance + c);
}

export function spentFrom(balance: number) {
  return Math.max(0, STARTING_CREDITS - balance);
}
