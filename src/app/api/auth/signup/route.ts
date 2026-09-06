import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  alreadyRegistered,
  friendlyPasswordError,
  MIN_PASSWORD,
  normalizeEmail,
} from "@/lib/auth/password-flow";
import { createAdminSupabase, findUserIdByEmail } from "@/lib/supabase/admin";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/keys";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD),
  redirectTo: z.string().url().optional(),
});

function alreadyExists(message: string) {
  const m = message.toLowerCase();
  return m.includes("already") || m.includes("registered");
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and a password of at least 8 characters." },
      { status: 400 },
    );
  }
  const email = normalizeEmail(parsed.data.email);
  const { password, redirectTo } = parsed.data;

  const admin = createAdminSupabase();
  if (admin) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!created.error) return NextResponse.json({ ok: true, confirm: false });
    if (!alreadyExists(created.error.message)) {
      return NextResponse.json(
        { error: friendlyPasswordError(created.error.message, created.error.code) },
        { status: 400 },
      );
    }
    const id = await findUserIdByEmail(email);
    if (!id) {
      return NextResponse.json(
        { error: "That email already has an account. Sign in instead." },
        { status: 409 },
      );
    }
    const updated = await admin.auth.admin.updateUserById(id, {
      password,
      email_confirm: true,
    });
    if (updated.error) {
      return NextResponse.json(
        { error: friendlyPasswordError(updated.error.message, updated.error.code) },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, confirm: false });
  }

  const url = supabaseUrl();
  const anon = supabasePublicKey();
  if (!url || !anon) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  });
  if (error) {
    return NextResponse.json(
      { error: friendlyPasswordError(error.message, error.code) },
      { status: error.status === 429 ? 429 : 400 },
    );
  }
  if (alreadyRegistered(data.user)) {
    return NextResponse.json(
      { error: "That email already has an account. Sign in instead." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, confirm: !data.session });
}
