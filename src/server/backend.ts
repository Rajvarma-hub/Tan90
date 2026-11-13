import "server-only";
import { connection } from "next/server";
import { env } from "@/config/env.server";
import { AppError, type ErrorCode } from "@/lib/errors";

// Thin client for the FastAPI backend. Signs in once as the service user and
// reuses the token until the backend rejects it.

let cachedToken: string | null = null;

const codeByStatus: Record<number, ErrorCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
};

async function request(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${env.BACKEND_API_URL}${path}`, {
      ...init,
      cache: "no-store",
    });
  } catch (cause) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Backend is not reachable at ${env.BACKEND_API_URL}. Is it running?`,
      { cause },
    );
  }
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: env.BACKEND_EMAIL,
      password: env.BACKEND_PASSWORD,
    }),
  });
  if (!response.ok) {
    throw new AppError(
      "UNAUTHORIZED",
      "Could not sign in to the backend. Check BACKEND_EMAIL and BACKEND_PASSWORD.",
    );
  }
  const { access_token } = (await response.json()) as { access_token: string };
  cachedToken = access_token;
  return access_token;
}

// FastAPI puts errors in `detail`: a string, an object with `message`, or a list of field issues.
function describeError(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((issue: { loc?: unknown[]; msg?: string }) =>
        [issue.loc?.slice(1).join("."), issue.msg].filter(Boolean).join(": "),
      )
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    const { message, available, requested } = detail as {
      message?: string;
      available?: number;
      requested?: number;
    };
    if (message && available !== undefined) {
      return `${message}: ${available} available, ${requested} needed`;
    }
    if (message) return message;
  }
  return `Backend request failed (${status})`;
}

export async function backend<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<T> {
  // Backend data is always live: opt the caller out of prerendering.
  await connection();
  const send = async () =>
    request(path, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        ...(options.body !== undefined && {
          "Content-Type": "application/json",
        }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let response = await send();
  if (response.status === 401) {
    cachedToken = null;
    response = await send();
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new AppError(
      codeByStatus[response.status] ?? "INTERNAL_ERROR",
      describeError(body, response.status),
    );
  }
  return (await response.json()) as T;
}
