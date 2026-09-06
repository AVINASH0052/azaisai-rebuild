import pino from "pino";
import { env } from "@/lib/env";

export const log = pino({
  level: env.LOG_LEVEL,
  base: { service: "azaisai" },
  redact: {
    paths: [
      "email",
      "prompt",
      "authorization",
      "headers.authorization",
      "*.key",
      "*.secret",
      "SERVICE_ROLE",
      "GOOGLE_AI_STUDIO",
      "google_ai_studio",
    ],
    remove: true,
  },
});

export function child(bindings: Record<string, unknown>) {
  return log.child(bindings);
}
