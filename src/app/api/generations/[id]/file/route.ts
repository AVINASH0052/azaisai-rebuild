import { NextResponse } from "next/server";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { workerFile } from "@/lib/worker";
import { byteRange, fetchGoogleMedia, pollGoogle } from "@/providers/google";

export const maxDuration = 60;

function videoHeaders(extra: Record<string, string>) {
  return {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    ...extra,
  };
}

function fromBuffer(buf: ArrayBuffer, rangeHeader: string | null, rid: string) {
  const total = buf.byteLength;
  const { start, end, status } = byteRange(rangeHeader, total);
  const slice = buf.slice(start, end + 1);
  return new NextResponse(slice, {
    status,
    headers: videoHeaders({
      "Content-Length": String(slice.byteLength),
      ...(status === 206
        ? { "Content-Range": `bytes ${start}-${end}/${total}` }
        : {}),
      "X-Request-Id": rid,
    }),
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rid = requestId(req.headers.get("x-request-id"));
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const op = new URL(req.url).searchParams.get("op");
  const range = req.headers.get("range");
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
      const media = await fetchGoogleMedia(uri, range);
      if (media.status === 206) {
        return new NextResponse(media.body, {
          status: 206,
          headers: videoHeaders({
            "Content-Type": media.headers.get("content-type") ?? "video/mp4",
            ...(media.headers.get("content-length")
              ? { "Content-Length": media.headers.get("content-length")! }
              : {}),
            ...(media.headers.get("content-range")
              ? { "Content-Range": media.headers.get("content-range")! }
              : {}),
            "X-Request-Id": rid,
          }),
        });
      }
      const buf = await media.arrayBuffer();
      return fromBuffer(buf, range, rid);
    }
    const file = await workerFile(decoded);
    if (!file) throw new AppError("NOT_FOUND", "Generated file is not ready.");
    const buf = await file.arrayBuffer();
    return fromBuffer(buf, range, rid);
  } catch (err) {
    const app =
      err instanceof AppError ? err : new AppError("NOT_FOUND", "Generated file is not ready.");
    return NextResponse.json(errorEnvelope(app, rid), { status: app.status });
  }
}
