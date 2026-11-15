// The session cookie holds the API's access token. Only its expiry is read here; the API
// checks the signature on every call, so nothing in the portal trusts the token's contents.

export const SESSION_COOKIE = "tan90_session";

/** A numeric claim of a JWT payload, or null if the token is malformed or lacks it. */
function numericClaim(token: string, name: "exp" | "iat"): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const value = (JSON.parse(json) as Record<string, unknown>)[name];
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}

/** Expiry of a JWT in epoch seconds, or null if the token is malformed. */
export function tokenExpiry(token: string): number | null {
  return numericClaim(token, "exp");
}

export function isTokenFresh(token: string | undefined, nowSeconds = Date.now() / 1000): boolean {
  if (!token) return false;
  const exp = tokenExpiry(token);
  return exp !== null && exp > nowSeconds;
}

/**
 * Sessions slide: an active person gets a fresh token once a quarter of this one's life has
 * passed, so the session only ends after a full token lifetime of inactivity.
 */
export function needsRenewal(token: string, nowSeconds = Date.now() / 1000): boolean {
  const issued = numericClaim(token, "iat");
  const exp = tokenExpiry(token);
  if (issued === null || exp === null) return false;
  return nowSeconds - issued > (exp - issued) * 0.25;
}

export function sessionCookieOptions(token: string, secure: boolean) {
  const expiry = tokenExpiry(token);
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    ...(expiry && { expires: new Date(expiry * 1000) }),
  };
}

/** Only same-site paths are allowed as a post-login destination, so a link cannot bounce users elsewhere. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
