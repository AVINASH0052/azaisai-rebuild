import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { currentAal, getPlatformAdmin } from "@/lib/auth/platform-admin";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const admin = await getPlatformAdmin(supabase, user?.id, user);
  if (!admin || !supabase || !user) notFound();
  if (!admin.demoReadonly && (await currentAal(supabase)) !== "aal2") {
    redirect("/auth/mfa?returnUrl=%2Fadmin");
  }
  return children;
}
