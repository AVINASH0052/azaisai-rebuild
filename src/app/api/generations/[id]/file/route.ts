import { NextResponse } from "next/server";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { workerFile } from "@/lib/worker";
import { fetchGoogleMedia, pollGoogle } from "@/providers/google";

export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rid = requestId(req.headers.get("x-request-id"));
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const op = new URL(req.url).searchParams.get("op");
  try {
    if (op) {
      const status = await pollGoogle({ provider: "google", jobId: op });
      if (status.state !== "succeeded" || !status.artifacts[0]?.url) {
        throw new AppError("NOT_FOUND", "Generated file is not ready.");
      }
      const uri = status.artifacts[0].url;
      if (uri.startsWith("data:")) {
        return NextResponse.redirect(uri);
      }
      const media = await fetchGoogleMedia(uri);
      return new NextResponse(media.body, {
        headers: {
          "Content-Type": media.headers.get("content-type") ?? "video/mp4",
          "X-Request-Id": rid,
        },
      });
    }
    const file = await workerFile(decoded);
    if (!file) throw new AppError("NOT_FOUND", "Generated file is not ready.");
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.headers.get("content-type") ?? "video/mp4",
        "X-Request-Id": rid,
      },
    });
  } catch (err) {
    const app =
      err instanceof AppError ? err : new AppError("NOT_FOUND", "Generated file is not ready.");
    return NextResponse.json(errorEnvelope(app, rid), { status: app.status });
  }
}
