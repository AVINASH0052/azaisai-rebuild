import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!(await isPlatformAdmin(supabase, user?.id))) notFound();
  return children;
}
