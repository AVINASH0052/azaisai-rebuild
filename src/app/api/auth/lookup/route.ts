import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoAdminEmail } from "@/lib/auth/demo-admin";
import { normalizeEmail } from "@/lib/auth/password-flow";
import { emailRegistered } from "@/lib/supabase/admin";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const email = normalizeEmail(parsed.data.email);
  if (isDemoAdminEmail(email)) return NextResponse.json({ exists: true });
  const exists = await emailRegistered(email);
  return NextResponse.json({ exists });
}
