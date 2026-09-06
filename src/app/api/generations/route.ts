import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { createServerSupabase, hasTestBypass } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { getModel } from "@/providers/registry";
import { quoteCredits } from "@/providers/quote";
import { createJobId } from "@/providers/mock-job";

const bodySchema = z.object({
  modelId: z.string(),
  prompt: z.string().min(1).max(4000),
  kind: z.enum(["video", "image"]),
  aspect: z.string(),
  durationSec: z.number().int().optional(),
  style: z.string().optional(),
});

export async function POST(req: Request) {
  const id = requestId(req.headers.get("x-request-id"));
  try {
    if (supabaseConfigured() && !(await hasTestBypass())) {
      const supabase = await createServerSupabase();
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to generate.");
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_REQUEST", "Prompt and model are required.");
    }
    const { modelId, kind, aspect, durationSec, style } = parsed.data;
    const model = getModel(modelId);
    if (!model || model.kind !== kind) {
      throw new AppError("INVALID_REQUEST", "Unknown model for this studio.");
    }
    if (!model.capabilities.aspects.includes(aspect)) {
      throw new AppError("UNSUPPORTED_PARAM", "That aspect ratio is not available.");
    }
    if (kind === "video") {
      const allowed = model.capabilities.durations ?? [];
      if (!durationSec || !allowed.includes(durationSec)) {
        throw new AppError("UNSUPPORTED_PARAM", "Pick a supported duration.");
      }
    }
    if (style && model.capabilities.styles && !model.capabilities.styles.includes(style)) {
      throw new AppError("UNSUPPORTED_PARAM", "That style is not available.");
    }
    const cost = quoteCredits(model, durationSec);
    const jobId = createJobId(kind);
    return NextResponse.json(
      {
        id: jobId,
        cost,
        estimatedSeconds: model.estimatedSeconds,
        provider: "mock",
      },
      { status: 202, headers: { "X-Request-Id": id } },
    );
  } catch (err) {
    const app =
      err instanceof AppError
        ? err
        : new AppError("INTERNAL", "Could not start that generation.");
    return NextResponse.json(errorEnvelope(app, id), {
      status: app.status,
      headers: { "X-Request-Id": id },
    });
  }
}
