const statusByCode = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof statusByCode;

export type FieldErrors = Record<string, string[] | undefined>;

export type ErrorPayload = {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
};

// Expected, client-safe errors. Anything else is treated as INTERNAL_ERROR and its message hidden.
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { fieldErrors?: FieldErrors; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.fieldErrors = options?.fieldErrors;
  }

  toPayload(): ErrorPayload {
    return {
      code: this.code,
      message: this.message,
      fieldErrors: this.fieldErrors,
    };
  }
}
