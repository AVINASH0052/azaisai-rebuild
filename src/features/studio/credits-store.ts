import { TEST_BYPASS_CREDITS, testBypassEnabled } from "@/lib/auth/test-bypass";

const KEY = "azai.credits.v2";
const START = TEST_BYPASS_CREDITS;

export function unlimitedCredits() {
  return testBypassEnabled();
}

export function formatCredits(n: number) {
  return Number.isFinite(n) ? String(n) : "∞";
}

export function readCredits() {
  if (unlimitedCredits()) return Number.POSITIVE_INFINITY;
  if (typeof window === "undefined") return START;
  const raw = window.localStorage.getItem(KEY);
  const n = raw == null ? START : Number(raw);
  return Number.isFinite(n) ? n : START;
}

export function writeCredits(n: number) {
  if (unlimitedCredits()) return;
  window.localStorage.setItem(KEY, String(Math.max(0, n)));
  window.dispatchEvent(new Event("azai-credits"));
}

export function debitCredits(cost: number) {
  if (unlimitedCredits()) return;
  writeCredits(readCredits() - cost);
}

export function refundCredits(cost: number) {
  if (unlimitedCredits()) return;
  writeCredits(readCredits() + cost);
}
