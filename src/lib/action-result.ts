import type { ErrorPayload } from "@/lib/errors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorPayload };
