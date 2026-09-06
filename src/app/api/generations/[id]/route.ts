import { NextResponse } from "next/server";
import { AppError, errorEnvelope } from "@/lib/errors";
import { requestId } from "@/lib/request-id";
import { mockStatus, parseJobId } from "@/providers/mock-job";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rid = requestId(req.headers.get("x-request-id"));
  const { id } = await params;
  const parsed = parseJobId(id);
  if (!parsed) {
    const err = new AppError("NOT_FOUND", "Generation not found.");
    return NextResponse.json(errorEnvelope(err, rid), { status: err.status });
  }
  return NextResponse.json(
    { id, ...mockStatus(parsed.createdAt, parsed.kind) },
    { headers: { "X-Request-Id": rid } },
  );
}
