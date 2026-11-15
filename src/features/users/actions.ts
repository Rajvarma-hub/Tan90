"use server";

import {
  createUserSchema,
  resetPasswordSchema,
  unlockUserSchema,
  updateUserSchema,
} from "@/features/users/schemas";
import { createAction } from "@/server/action";
import { backend } from "@/server/backend";

const userPath = (id: string) => `/api/admin/users/${encodeURIComponent(id)}`;

export const createUser = createAction(createUserSchema, async (input) => {
  await backend("/api/auth/register", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
      full_name: input.fullName,
      role: input.role,
      location_id: input.locationId,
      customer_id: input.customerId,
      customer_name: input.customerId ? null : input.customerName,
    },
  });
  return null;
});

export const updateUser = createAction(updateUserSchema, async (input) => {
  await backend(userPath(input.id), {
    method: "PATCH",
    body: {
      full_name: input.fullName,
      role: input.role,
      location_id: input.locationId,
      is_active: input.isActive,
    },
  });
  return null;
});

export const resetUserPassword = createAction(resetPasswordSchema, async (input) => {
  await backend(`${userPath(input.id)}/password`, {
    method: "POST",
    body: { new_password: input.newPassword },
  });
  return null;
});

export const unlockUser = createAction(unlockUserSchema, async (input) => {
  await backend(`${userPath(input.id)}/unlock`, { method: "POST" });
  return null;
});
