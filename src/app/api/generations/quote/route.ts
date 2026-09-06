import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { getModel } from "@/providers/registry";
import { quoteCredits } from "@/providers/quote";

const bodySchema = z.object({
  modelId: z.string(),
  durationSec: z.number().int().optional(),
});

export async function POST(req: Request) {
  const id = requestId(req.headers.get("x-request-id"));
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_REQUEST", "modelId is required.");
    }
    const model = getModel(parsed.data.modelId);
    if (!model) throw new AppError("INVALID_REQUEST", "Unknown model.");
    return NextResponse.json(
      { cost: quoteCredits(model, parsed.data.durationSec), model: model.id },
      { headers: { "X-Request-Id": id } },
    );
  } catch (err) {
    const app =
      err instanceof AppError ? err : new AppError("INTERNAL", "Could not quote.");
    return NextResponse.json(errorEnvelope(app, id), {
      status: app.status,
      headers: { "X-Request-Id": id },
    });
  }
}
