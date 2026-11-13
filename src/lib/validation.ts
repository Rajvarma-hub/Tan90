import { z } from "zod";
import { AppError } from "@/lib/errors";

export function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid input", {
      fieldErrors: z.flattenError(result.error).fieldErrors,
    });
  }
  return result.data;
}
