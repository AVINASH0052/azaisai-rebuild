import { NextResponse } from "next/server";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { mockStatus, parseJobId } from "@/providers/mock-job";
import { pollGoogle } from "@/providers/google";
import { isLiveJobId } from "@/providers/pipeline";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rid = requestId(req.headers.get("x-request-id"));
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  if (decoded.includes("operations/") || decoded.startsWith("models/")) {
    const status = await pollGoogle({ provider: "google", jobId: decoded });
    if (status.state === "succeeded") {
      const op = encodeURIComponent(decoded);
      return NextResponse.json(
        {
          id: decoded,
          status: "ready",
          progress: 100,
          stage: "Ready",
          outputUrl: `/api/generations/${encodeURIComponent(decoded)}/file?op=${op}`,
        },
        { headers: { "X-Request-Id": rid } },
      );
    }
    if (status.state === "failed") {
      return NextResponse.json(
        { id: decoded, status: "failed", progress: 0, stage: status.message },
        { headers: { "X-Request-Id": rid } },
      );
    }
    return NextResponse.json(
      {
        id: decoded,
        status: "processing",
        progress: status.state === "processing" ? (status.pct ?? 40) : 10,
        stage: status.state === "processing" ? (status.stage ?? "Veo rendering") : "Queued",
      },
      { headers: { "X-Request-Id": rid } },
    );
  }
  if (isLiveJobId(decoded)) {
    return NextResponse.json(
      { id: decoded, status: "processing", progress: 10, stage: "Veo rendering" },
      { headers: { "X-Request-Id": rid } },
    );
  }
  const parsed = parseJobId(decoded);
  if (!parsed) {
    const err = new AppError("NOT_FOUND", "Generation not found.");
    return NextResponse.json(errorEnvelope(err, rid), { status: err.status });
  }
  return NextResponse.json(
    { id: decoded, ...mockStatus(parsed.createdAt, parsed.kind, parsed.segments) },
    { headers: { "X-Request-Id": rid } },
  );
}
