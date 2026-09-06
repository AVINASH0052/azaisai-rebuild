import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/password-flow";
import { emailRegistered } from "@/lib/supabase/admin";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const exists = await emailRegistered(normalizeEmail(parsed.data.email));
  return NextResponse.json({ exists });
}
