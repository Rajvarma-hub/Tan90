import "server-only";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { parseOrThrow } from "@/lib/validation";
import { toAppError } from "@/server/errors";

export function createAction<TSchema extends z.ZodType, TOutput>(
  schema: TSchema,
  handler: (input: z.output<TSchema>) => Promise<TOutput>,
) {
  return async (input: z.input<TSchema>): Promise<ActionResult<TOutput>> => {
    try {
      const data = await handler(parseOrThrow(schema, input));
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: toAppError(error).toPayload() };
    }
  };
}
