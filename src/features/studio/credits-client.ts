import { readCredits, refundCredits, writeCredits } from "./credits-store";

type CreditsPayload = { balance?: number; local?: boolean };

async function parseCredits(res: Response): Promise<CreditsPayload> {
  return (await res.json().catch(() => ({}))) as CreditsPayload;
}

export async function pullCredits() {
  try {
    const json = await parseCredits(await fetch("/api/credits"));
    if (typeof json.balance === "number") {
      writeCredits(json.balance);
      return json.balance;
    }
  } catch {
    // keep the cached meter if the account endpoint is down
  }
  return readCredits();
}

export async function restoreCredits(undo: number) {
  try {
    const json = await parseCredits(await fetch("/api/credits"));
    if (typeof json.balance === "number") {
      writeCredits(json.balance);
      return;
    }
  } catch {
    // fall through to the optimistic undo
  }
  refundCredits(undo);
}

export async function returnCredits(amount: number) {
  try {
    const json = await parseCredits(
      await fetch("/api/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
      }),
    );
    if (typeof json.balance === "number") {
      writeCredits(json.balance);
      return;
    }
  } catch {
    // fall through
  }
  refundCredits(amount);
}
