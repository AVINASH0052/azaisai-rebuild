import { createClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "./keys";

/** ponytail: GoTrue has no getUserByEmail in this client. Filter the admin list by email. */
async function emailRegisteredAdmin(email: string): Promise<boolean | null> {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    users?: { email?: string | null }[];
    user?: { email?: string | null };
  };
  const users = json.users ?? (json.user ? [json.user] : []);
  return users.some((u) => (u.email ?? "").toLowerCase() === email);
}

async function emailRegisteredRpc(email: string): Promise<boolean | null> {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) return null;
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("email_registered", { addr: email });
  if (error || typeof data !== "boolean") return null;
  return data;
}

export async function emailRegistered(email: string): Promise<boolean | null> {
  const admin = await emailRegisteredAdmin(email);
  if (admin !== null) return admin;
  return emailRegisteredRpc(email);
}
