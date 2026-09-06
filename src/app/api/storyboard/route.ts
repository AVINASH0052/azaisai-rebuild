import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { createServerSupabase, hasTestBypass } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { isVideoDuration } from "@/providers/long-video";
import { planStoryboard } from "@/services/prompt/storyboard";

const bodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  durationSec: z.number().int(),
});

export async function POST(req: Request) {
  const id = requestId(req.headers.get("x-request-id"));
  try {
    if (supabaseConfigured() && !(await hasTestBypass())) {
      const supabase = await createServerSupabase();
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to plan a storyboard.");
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success || !isVideoDuration(parsed.data.durationSec)) {
      throw new AppError("INVALID_REQUEST", "Pick a length between 4 and 20 seconds.");
    }
    const beats = await planStoryboard(parsed.data);
    return NextResponse.json({ beats }, { headers: { "X-Request-Id": id } });
  } catch (err) {
    const app =
      err instanceof AppError
        ? err
        : new AppError("INTERNAL", "Could not plan that storyboard.");
    return NextResponse.json(errorEnvelope(app, id), {
      status: app.status,
      headers: { "X-Request-Id": id },
    });
  }
}
