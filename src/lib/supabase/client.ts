import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicKey, supabaseUrl } from "./keys";

export function createBrowserSupabase() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) throw new Error("Supabase is not configured");
  return createBrowserClient(url, key);
}
