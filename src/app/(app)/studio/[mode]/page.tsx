import { notFound } from "next/navigation";

const MODES = ["video", "image"] as const;

export default async function StudioPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  if (!MODES.includes(mode as (typeof MODES)[number])) notFound();
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl text-fg">
        {mode === "video" ? "Video studio" : "Image studio"}
      </h1>
      <p className="mt-2 max-w-md text-fg-muted">
        Nothing yet. The generate loop lands in the next slice. You already have
        a workspace and a 5-credit welcome grant.
      </p>
    </main>
  );
}
