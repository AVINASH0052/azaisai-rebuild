import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { variatePrompt } from "@/services/prompt/enhance";

const bodySchema = z.object({
  prompt: z.string().min(1),
  kind: z.enum(["video", "image"]).optional(),
});

export async function POST(req: Request) {
  const id = requestId(req.headers.get("x-request-id"));
  try {
    if (supabaseConfigured()) {
      const supabase = await createServerSupabase();
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to vary a prompt.");
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_REQUEST", "Prompt is required.");
    }
    const variations = await variatePrompt(parsed.data);
    return NextResponse.json(
      { variations, model: "gemini" },
      { headers: { "X-Request-Id": id } },
    );
  } catch (err) {
    const app =
      err instanceof AppError
        ? err
        : new AppError("INTERNAL", "Could not vary that prompt.");
    return NextResponse.json(errorEnvelope(app, id), {
      status: app.status,
      headers: { "X-Request-Id": id },
    });
  }
}
