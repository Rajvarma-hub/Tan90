import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/lib/errors";
import { logger } from "@/server/logger";

// Call first in a catch block: lets redirect()/notFound() through and masks unexpected errors.
export function toAppError(error: unknown): AppError {
  unstable_rethrow(error);
  if (error instanceof AppError) return error;
  logger.error("Unhandled server error", { error });
  return new AppError("INTERNAL_ERROR", "Something went wrong", {
    cause: error,
  });
}
