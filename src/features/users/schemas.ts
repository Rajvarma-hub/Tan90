import { z } from "zod";
import { newPasswordSchema } from "@/features/auth/schemas";
import { roles, STATION_ROLES } from "@/lib/permissions";

const id = z.string().min(1).max(64);

// The same password rules as changing your own password.
const password = newPasswordSchema;

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
    fullName: z.string().trim().min(1, "Enter a name").max(200),
    role: z.enum(roles),
    password,
    locationId: id.nullable(),
    // A customer user joins an existing customer, or starts a new one.
    customerId: id.nullable(),
    customerName: z.string().trim().min(1).max(200).nullable(),
  })
  .superRefine((value, context) => {
    if (STATION_ROLES.includes(value.role) && !value.locationId) {
      context.addIssue({ code: "custom", path: ["locationId"], message: "Choose a location" });
    }
    if (value.role === "CUSTOMER" && !value.customerId && !value.customerName) {
      context.addIssue({
        code: "custom",
        path: ["customerName"],
        message: "Choose a customer or enter a new one",
      });
    }
  });

export const updateUserSchema = z.object({
  id,
  fullName: z.string().trim().min(1, "Enter a name").max(200),
  role: z.enum(roles),
  locationId: id.nullable(),
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({ id, newPassword: password });

export const unlockUserSchema = z.object({ id });
