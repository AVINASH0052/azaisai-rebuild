export const ERROR_CODES = [
  "INVALID_REQUEST",
  "UNSUPPORTED_PARAM",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "INSUFFICIENT_CREDITS",
  "CONTENT_POLICY",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNSUPPORTED_PARAM: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409,
  INSUFFICIENT_CREDITS: 402,
  CONTENT_POLICY: 422,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export function errorEnvelope(err: AppError, requestId: string) {
  return {
    error: {
      code: err.code,
      message: err.message,
      details: err.details,
      request_id: requestId,
    },
  };
}
