import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_BACKEND_API_URL } from "@/config/backend-url";
import {
  SESSION_COOKIE,
  isTokenFresh,
  needsRenewal,
  sessionCookieOptions,
} from "@/lib/session-token";

function toSignIn(request: NextRequest, reason?: string) {
  const { pathname, search } = request.nextUrl;
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  if (reason) url.searchParams.set("reason", reason);
  const response = NextResponse.redirect(url);
  if (reason) response.cookies.delete(SESSION_COOKIE);
  return response;
}

// Swaps an ageing token for a fresh one. Returns the new token, "ended" if the API refused the
// old one, or null when the API could not be reached (the old token keeps working meanwhile).
async function renew(token: string): Promise<string | "ended" | null> {
  try {
    const response = await fetch(
      `${process.env.BACKEND_API_URL ?? DEFAULT_BACKEND_API_URL}/api/auth/refresh`,
      {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    );
    if (response.status === 401) return "ended";
    if (!response.ok) return null;
    return ((await response.json()) as { access_token: string }).access_token;
  } catch {
    return null;
  }
}

// No cookie or an expired one goes to the sign-in page. The API still verifies the token on
// every call, so a forged cookie gets a sign-in redirect there too. An active session is renewed
// here, because a cookie can only be written in a proxy, route handler or Server Action.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !isTokenFresh(token)) return toSignIn(request);

  const response = NextResponse.next();
  // Page prefetches should not extend a session nobody is using.
  if (request.headers.has("next-router-prefetch") || !needsRenewal(token)) return response;

  const renewed = await renew(token);
  if (renewed === "ended") return toSignIn(request, "expired");
  if (renewed) {
    response.cookies.set(
      SESSION_COOKIE,
      renewed,
      sessionCookieOptions(renewed, process.env.NODE_ENV === "production"),
    );
  }
  return response;
}

export const config = {
  // The sign-in page, health check, framework files and brand images stay public.
  matcher: ["/((?!login|api/health|_next/static|_next/image|brand|favicon.ico).*)"],
};
