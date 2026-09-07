import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicKey, supabaseUrl } from "./keys";

let browser: ReturnType<typeof createBrowserClient> | null = null;

export function createBrowserSupabase() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) throw new Error("Supabase is not configured");
  if (!browser) browser = createBrowserClient(url, key);
  return browser;
}

/** Open TLS to GoTrue before the user clicks Sign in. */
export function warmBrowserSupabase() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) return;
  const sb = createBrowserSupabase();
  void sb.auth.getSession();
  void fetch(`${url}/auth/v1/health`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).catch(() => undefined);
}
