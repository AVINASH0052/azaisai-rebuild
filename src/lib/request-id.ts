import { randomUUID } from "node:crypto";

export function requestId(header?: string | null) {
  if (header && /^[\w-]{8,64}$/.test(header)) return header;
  return `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
