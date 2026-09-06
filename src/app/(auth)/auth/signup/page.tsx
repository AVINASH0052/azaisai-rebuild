import { redirect } from "next/navigation";
import { parseReturnUrl } from "@/lib/auth/return-url";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const { returnUrl } = await searchParams;
  const dest = parseReturnUrl(returnUrl);
  redirect(dest ? `/auth/login?returnUrl=${encodeURIComponent(dest)}` : "/auth/login");
}
