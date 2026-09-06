import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  TEST_BYPASS_COOKIE,
  isValidBypassCookie,
  testBypassSecret,
} from "@/lib/auth/test-bypass";
import { supabasePublicKey, supabaseUrl } from "./keys";

export async function hasTestBypass() {
  const jar = await cookies();
  return isValidBypassCookie(jar.get(TEST_BYPASS_COOKIE)?.value, testBypassSecret());
}

export async function createServerSupabase() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot set cookies; middleware refreshes the session.
        }
      },
    },
  });
}
