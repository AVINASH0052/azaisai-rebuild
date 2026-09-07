import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { notifyWorker } from "@/lib/worker";
import { createServerSupabase, hasTestBypass } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { getModel } from "@/providers/registry";
import { quoteCredits } from "@/providers/quote";
import { createJobId } from "@/providers/mock-job";
import { isVideoDuration, segmentCount, veoSecForBeat } from "@/providers/long-video";
import { env } from "@/lib/env";
import { generateGoogleImage, googleLive, submitGoogleVideo } from "@/providers/google";
import { createLiveJobId } from "@/providers/pipeline";
import { refundCreditsAccount, spendCredits } from "@/services/credits/spend";

export const maxDuration = 60;

const bodySchema = z.object({
  modelId: z.string(),
  prompt: z.string().min(1).max(4000),
  kind: z.enum(["video", "image"]),
  aspect: z.string(),
  durationSec: z.number().int().optional(),
  style: z.string().optional(),
  storyboard: z
    .array(
      z.object({
        index: z.number().int(),
        startSec: z.number(),
        endSec: z.number(),
        contentSec: z.number().optional(),
        veoSec: z.number().optional(),
        prompt: z.string().min(1),
      }),
    )
    .optional(),
});

export async function POST(req: Request) {
  const id = requestId(req.headers.get("x-request-id"));
  const bypass = await hasTestBypass();
  const supabase =
    supabaseConfigured() && !bypass ? await createServerSupabase() : null;
  let charged = 0;
  let cost = 0;
  try {
    if (supabaseConfigured() && !bypass) {
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to generate.");
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_REQUEST", "Prompt and model are required.");
    }
    const { modelId, kind, aspect, durationSec, style, storyboard, prompt } = parsed.data;
    const model = getModel(modelId);
    if (!model || model.kind !== kind) {
      throw new AppError("INVALID_REQUEST", "Unknown model for this studio.");
    }
    if (!model.capabilities.aspects.includes(aspect)) {
      throw new AppError("UNSUPPORTED_PARAM", "That aspect ratio is not available.");
    }
    if (kind === "video" && (durationSec == null || !isVideoDuration(durationSec))) {
      throw new AppError("UNSUPPORTED_PARAM", "Pick a length between 4 and 20 seconds.");
    }
    if (style && model.capabilities.styles && !model.capabilities.styles.includes(style)) {
      throw new AppError("UNSUPPORTED_PARAM", "That style is not available.");
    }
    const segments = kind === "video" && durationSec ? segmentCount(durationSec) : 1;
    if (storyboard && storyboard.length !== segments) {
      throw new AppError("INVALID_REQUEST", "Storyboard length must match segment count.");
    }
    cost = quoteCredits(model, durationSec);
    const firstPrompt = storyboard?.[0]?.prompt ?? prompt;
    let balance: number | undefined;
    if (supabase) {
      // ponytail: last-write-wins on user_metadata; upgrade to a ledger RPC if two tabs spend at once
      balance = await spendCredits(supabase, cost);
      charged = cost;
    }

    if (googleLive(model)) {
      try {
        if (kind === "image") {
          const outputUrl = await generateGoogleImage(model, firstPrompt);
          return NextResponse.json(
            {
              id: createLiveJobId("image"),
              cost,
              balance,
              segments: 1,
              provider: "google",
              status: "ready",
              outputUrl,
            },
            { status: 202, headers: { "X-Request-Id": id } },
          );
        }
        const firstLen = storyboard?.[0]?.veoSec ?? veoSecForBeat(durationSec ?? 8, 0);
        const handle = await submitGoogleVideo(model, {
          prompt: firstPrompt,
          aspect,
          durationSec: firstLen,
        });
        const jobId = createLiveJobId("video", { durationSec, segments });
        void notifyWorker({ type: "ping", id: jobId });
        return NextResponse.json(
          {
            id: jobId,
            cost,
            balance,
            segments,
            provider: "google",
            operation: handle.jobId,
            estimatedSeconds: model.estimatedSeconds * segments,
          },
          { status: 202, headers: { "X-Request-Id": id } },
        );
      } catch (err) {
        if (env.PROVIDER_MODE !== "auto") throw err;
        // fall through to mock so the studio still delivers a file
      }
    }

    const jobId = createJobId(kind, { durationSec, segments });
    void notifyWorker({ type: "ping", id: jobId });
    return NextResponse.json(
      {
        id: jobId,
        cost,
        balance,
        segments,
        estimatedSeconds: model.estimatedSeconds * segments,
        provider: "mock",
      },
      { status: 202, headers: { "X-Request-Id": id } },
    );
  } catch (err) {
    if (charged && supabase) {
      await refundCreditsAccount(supabase, charged).catch(() => null);
    }
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
