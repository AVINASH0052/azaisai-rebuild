import { STARTING_CREDITS } from "@/services/credits/meter";

const KEY = "azai.credits.v2";
const START = STARTING_CREDITS;

export function formatCredits(n: number) {
  return Number.isFinite(n) ? String(n) : "∞";
}

export function readCredits() {
  if (typeof window === "undefined") return START;
  const raw = window.localStorage.getItem(KEY);
  const n = raw == null ? START : Number(raw);
  return Number.isFinite(n) ? n : START;
}

export function writeCredits(n: number) {
  window.localStorage.setItem(KEY, String(Math.max(0, n)));
  window.dispatchEvent(new Event("azai-credits"));
}

export function debitCredits(cost: number) {
  writeCredits(readCredits() - cost);
}

export function refundCredits(cost: number) {
  writeCredits(readCredits() + cost);
}
