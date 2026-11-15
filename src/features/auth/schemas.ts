import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;

// bcrypt, which the API uses, rejects secrets over 72 bytes.
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Use at most 72 bytes");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The new passwords do not match",
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password you are not already using",
  });

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
