import { describe, expect, it } from "vitest";
import { isTokenFresh, needsRenewal, safeNextPath, sessionCookieOptions, tokenExpiry } from "@/lib/session-token";

function token(payload: object) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.signature`;
}

describe("tokenExpiry", () => {
  it("reads exp from the payload", () => {
    expect(tokenExpiry(token({ exp: 1_800_000_000 }))).toBe(1_800_000_000);
  });

  it.each(["", "abc", "a.b.c", `a.${Buffer.from("[]").toString("base64url")}.c`])(
    "returns null for %j",
    (value) => {
      expect(tokenExpiry(value)).toBeNull();
    },
  );

  it("returns null when exp is not a number", () => {
    expect(tokenExpiry(token({ exp: "soon" }))).toBeNull();
  });
});

describe("isTokenFresh", () => {
  const now = 1_000;

  it("is true until the expiry", () => {
    expect(isTokenFresh(token({ exp: 2_000 }), now)).toBe(true);
    expect(isTokenFresh(token({ exp: 1_000 }), now)).toBe(false);
    expect(isTokenFresh(token({ exp: 500 }), now)).toBe(false);
  });

  it("is false for a missing or malformed token", () => {
    expect(isTokenFresh(undefined, now)).toBe(false);
    expect(isTokenFresh("garbage", now)).toBe(false);
  });
});

describe("needsRenewal", () => {
  // Issued at 1000, expires at 5000: a 4000 second life, renewed after 1000 seconds.
  const t = token({ iat: 1_000, exp: 5_000 });

  it("waits until a quarter of the life has passed", () => {
    expect(needsRenewal(t, 1_500)).toBe(false);
    expect(needsRenewal(t, 2_000)).toBe(false);
    expect(needsRenewal(t, 2_001)).toBe(true);
  });

  it("does not renew a token without both claims", () => {
    expect(needsRenewal(token({ exp: 5_000 }), 4_000)).toBe(false);
    expect(needsRenewal("garbage", 4_000)).toBe(false);
  });
});

describe("sessionCookieOptions", () => {
  it("expires with the token and is only readable by the server", () => {
    const options = sessionCookieOptions(token({ exp: 2_000 }), true);
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(options.expires).toEqual(new Date(2_000_000));
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/orders/ord-1?tab=history")).toBe("/orders/ord-1?tab=history");
  });

  it.each([null, undefined, "", "orders", "https://evil.example", "//evil.example", "/\\evil.example"])(
    "falls back to the home page for %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );
});
