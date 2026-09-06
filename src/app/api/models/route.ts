import { NextResponse } from "next/server";
import { MODELS } from "@/providers/registry";
import { quoteCredits } from "@/providers/quote";

export async function GET() {
  return NextResponse.json({
    models: MODELS.map((m) => ({
      ...m,
      sampleCost: quoteCredits(m, m.capabilities.durations?.at(-1)),
    })),
  });
}
