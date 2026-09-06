import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { createServerSupabase, hasTestBypass } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { workerConfigured, workerLastFrame, workerStitch } from "@/lib/worker";
import { getModel } from "@/providers/registry";
import { submitGoogleVideo, pollGoogle, type SeedImage } from "@/providers/google";
import { afterSegmentReady, clipFileUrl, pipelineProgress } from "@/providers/pipeline";
import { veoSecForBeat } from "@/providers/long-video";

export const maxDuration = 60;

const bodySchema = z.object({
  id: z.string().min(1),
  modelId: z.string(),
  aspect: z.string(),
  durationSec: z.number().int().optional(),
  operation: z.string().min(1),
  segment: z.number().int().min(0),
  segments: z.number().int().min(1),
  videoUris: z.array(z.string()).default([]),
  completedOps: z.array(z.string()).default([]),
  seedImage: z
    .object({
      mimeType: z.string().min(1).max(64),
      data: z.string().min(32).max(2_000_000),
    })
    .optional(),
  storyboard: z
    .array(
      z.object({
        index: z.number().int(),
        prompt: z.string().min(1),
        contentSec: z.number().optional(),
        veoSec: z.number().optional(),
      }),
    )
    .optional(),
});

type ProgressBody = z.infer<typeof bodySchema>;

async function startNextBeat(body: ProgressBody, seed: SeedImage) {
  const model = getModel(body.modelId);
  if (!model) throw new AppError("INVALID_REQUEST", "Unknown model.");
  const beat = body.storyboard?.find((b) => b.index === body.videoUris.length);
  return submitGoogleVideo(model, {
    prompt: beat?.prompt ?? "Continues from the last frame.",
    aspect: body.aspect,
    durationSec: beat?.veoSec ?? veoSecForBeat(body.durationSec ?? 8, body.videoUris.length),
    seedImage: seed,
  });
}

export async function POST(req: Request) {
  const rid = requestId(req.headers.get("x-request-id"));
  try {
    if (supabaseConfigured() && !(await hasTestBypass())) {
      const supabase = await createServerSupabase();
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to generate.");
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_REQUEST", "Progress payload is incomplete.");
    }
    const body = parsed.data;
    const model = getModel(body.modelId);
    if (!model) throw new AppError("INVALID_REQUEST", "Unknown model.");

    if (body.seedImage) {
      if (body.videoUris.length >= body.segments) {
        throw new AppError("INVALID_REQUEST", "All segments are already generated.");
      }
      const handle = await startNextBeat(body, body.seedImage);
      return NextResponse.json(
        {
          id: body.id,
          status: "processing",
          operation: handle.jobId,
          segment: body.videoUris.length,
          videoUris: body.videoUris,
          completedOps: body.completedOps,
          ...pipelineProgress(body.videoUris.length, body.segments),
        },
        { headers: { "X-Request-Id": rid } },
      );
    }

    const status = await pollGoogle({ provider: "google", jobId: body.operation });
    if (status.state === "failed") {
      return NextResponse.json(
        { id: body.id, status: "failed", progress: 0, stage: status.message },
        { headers: { "X-Request-Id": rid } },
      );
    }
    if (status.state !== "succeeded") {
      return NextResponse.json(
        {
          id: body.id,
          status: "processing",
          operation: body.operation,
          ...pipelineProgress(body.segment, body.segments),
        },
        { headers: { "X-Request-Id": rid } },
      );
    }

    const uri = status.artifacts[0]?.url;
    if (!uri) throw new AppError("PROVIDER_UNAVAILABLE", "Veo finished with no file.");
    const next = afterSegmentReady(
      { segment: body.segment, segments: body.segments, videoUris: body.videoUris },
      uri,
      workerConfigured(),
    );
    const completedOps = [...body.completedOps, body.operation];
    const outputUrls = completedOps.map((op) => clipFileUrl(body.id, op));

    if (next.action === "ready") {
      return NextResponse.json(
        {
          id: body.id,
          status: "ready",
          progress: 100,
          stage: outputUrls.length > 1 ? "Ready · clips play in order" : "Ready",
          outputUrl: outputUrls[0],
          outputUrls,
          videoUris: next.videoUris,
          completedOps,
        },
        { headers: { "X-Request-Id": rid } },
      );
    }

    if (next.action === "stitch") {
      await workerStitch({
        id: body.id,
        videoUris: next.videoUris,
        durationSec: body.durationSec,
      });
      return NextResponse.json(
        {
          id: body.id,
          status: "ready",
          progress: 100,
          stage: next.videoUris.length > 1 ? "Stitched" : "Ready",
          outputUrl: `/api/generations/${encodeURIComponent(body.id)}/file`,
          outputUrls,
          videoUris: next.videoUris,
          completedOps,
        },
        { headers: { "X-Request-Id": rid } },
      );
    }

    if (workerConfigured()) {
      const frame = await workerLastFrame(body.id, next.seedFromUri);
      const handle = await startNextBeat(
        { ...body, videoUris: next.videoUris },
        { mimeType: frame.mimeType, data: frame.data },
      );
      return NextResponse.json(
        {
          id: body.id,
          status: "processing",
          operation: handle.jobId,
          segment: next.nextIndex,
          videoUris: next.videoUris,
          completedOps,
          ...pipelineProgress(next.nextIndex, body.segments),
        },
        { headers: { "X-Request-Id": rid } },
      );
    }

    return NextResponse.json(
      {
        id: body.id,
        status: "need_seed",
        progress: pipelineProgress(next.nextIndex, body.segments).progress,
        stage: "Capturing last frame",
        lastUrl: clipFileUrl(body.id, body.operation),
        videoUris: next.videoUris,
        completedOps,
        outputUrls,
        segment: next.nextIndex,
      },
      { headers: { "X-Request-Id": rid } },
    );
  } catch (err) {
    const app =
      err instanceof AppError
        ? err
        : new AppError("INTERNAL", "Could not advance that generation.");
    return NextResponse.json(errorEnvelope(app, rid), {
      status: app.status,
      headers: { "X-Request-Id": rid },
    });
  }
}
