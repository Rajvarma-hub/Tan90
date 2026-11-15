"use server";

import { cookies } from "next/headers";
import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { env } from "@/config/env.server";
import { SESSION_COOKIE, safeNextPath, sessionCookieOptions } from "@/lib/session-token";
import { logger } from "@/server/logger";
import { changePasswordSchema } from "@/features/auth/schemas";
import { createAction } from "@/server/action";
import { backend, backendLogin, backendLogout } from "@/server/backend";

export type SignInState = { error: string | null };

const signInSchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
  next: z.string().max(500).nullable(),
});

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: "Enter your email and password." };
  const { email, password, next } = parsed.data;

  let token: string;
  try {
    const result = await backendLogin(email, password);
    if ("failure" in result) {
      return {
        error:
          result.failure === "locked"
            ? "Too many failed attempts. Wait a few minutes, then try again."
            : "Incorrect email or password.",
      };
    }
    token = result.token;
  } catch (error) {
    unstable_rethrow(error);
    logger.error("Sign-in failed", { error });
    return { error: "Could not reach the server. Try again in a moment." };
  }

  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(token, env.NODE_ENV === "production"));
  redirect(safeNextPath(next) as Route);
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await backendLogout(token);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

// The API ends every other session when the password changes and returns a token for this one.
export const changePassword = createAction(changePasswordSchema, async (input) => {
  const { access_token } = await backend<{ access_token: string }>("/api/auth/change-password", {
    method: "POST",
    body: { current_password: input.currentPassword, new_password: input.newPassword },
  });
  (await cookies()).set(
    SESSION_COOKIE,
    access_token,
    sessionCookieOptions(access_token, env.NODE_ENV === "production"),
  );
  return null;
});
