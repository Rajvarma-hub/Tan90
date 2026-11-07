import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { toAppError } from "@/server/errors";

export function withErrorHandling<TArgs extends unknown[]>(
  handler: (request: NextRequest, ...args: TArgs) => Promise<Response>,
) {
  return async (request: NextRequest, ...args: TArgs): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      const appError = toAppError(error);
      return Response.json(
        { error: appError.toPayload() },
        { status: appError.status },
      );
    }
  };
}

export async function parseJson<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  const body: unknown = await request.json().catch(() => {
    throw new AppError("BAD_REQUEST", "Malformed JSON body");
  });
  return parseOrThrow(schema, body);
}
