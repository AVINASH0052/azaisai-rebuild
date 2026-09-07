import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminPasswordMatches,
  demoAdminPassword,
  isDemoAdminEmail,
} from "@/lib/auth/demo-admin-secret";
import { normalizeEmail } from "@/lib/auth/password-flow";
import { createAdminSupabase, findUserIdByEmail } from "@/lib/supabase/admin";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/keys";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the admin email and password." }, { status: 400 });
  }
  const email = normalizeEmail(parsed.data.email);
  if (!isDemoAdminEmail(email) || !adminPasswordMatches(parsed.data.password)) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const password = demoAdminPassword();
  const admin = createAdminSupabase();
  if (admin) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { credits: 80, role: "admin" },
    });
    if (created.error) {
      const id = await findUserIdByEmail(email);
      if (id) {
        await admin.auth.admin.updateUserById(id, {
          password,
          email_confirm: true,
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  const url = supabaseUrl();
  const anon = supabasePublicKey();
  if (!url || !anon) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await sb.auth.signInWithPassword({ email, password });
  if (signedIn.data.session) return NextResponse.json({ ok: true });
  const signedUp = await sb.auth.signUp({ email, password });
  if (signedUp.error && !signedUp.error.message.toLowerCase().includes("already")) {
    return NextResponse.json({ error: "Could not prepare the admin account." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
