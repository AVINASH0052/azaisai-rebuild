import { notFound } from "next/navigation";
import { Studio } from "@/features/studio/studio";

const MODES = ["video", "image"] as const;

export default async function StudioPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  if (!MODES.includes(mode as (typeof MODES)[number])) notFound();
  return <Studio mode={mode as (typeof MODES)[number]} />;
}
