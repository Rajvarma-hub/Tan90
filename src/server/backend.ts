import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { env } from "@/config/env.server";
import { AppError, type ErrorCode } from "@/lib/errors";
import { SESSION_COOKIE } from "@/lib/session-token";

// Thin client for the FastAPI backend. Every call carries the signed-in user's own token,
// so the API decides what that person may do.

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

export type LoginResult = { token: string } | { failure: "invalid" | "locked" };

// Wrong credentials and a locked account are results; any other failure throws.
export async function backendLogin(email: string, password: string): Promise<LoginResult> {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.status === 401 || response.status === 422) return { failure: "invalid" };
  if (response.status === 429) return { failure: "locked" };
  if (!response.ok) {
    throw new AppError("INTERNAL_ERROR", `Sign-in failed (${response.status})`);
  }
  const { access_token } = (await response.json()) as { access_token: string };
  return { token: access_token };
}

// Ends the session on the API side too, so a copied token stops working. Never throws:
// signing out must work even when the API is down.
export async function backendLogout(token: string): Promise<void> {
  try {
    await request("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
  } catch {
    // The cookie is removed regardless; the token still expires on its own.
  }
}

async function sessionToken(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  return token;
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
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    // For the moment between sign-in and the cookie being set.
    token?: string;
  } = {},
): Promise<T> {
  // Backend data is always live: opt the caller out of prerendering.
  await connection();
  const token = options.token ?? (await sessionToken());
  const response = await request(path, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined && {
        "Content-Type": "application/json",
      }),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  // The token expired or the account was switched off: sign in again.
  if (response.status === 401 && !options.token) redirect("/login?reason=expired");
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new AppError(
      codeByStatus[response.status] ?? "INTERNAL_ERROR",
      describeError(body, response.status),
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
