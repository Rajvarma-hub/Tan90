import { describe, expect, it } from "vitest";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "@/features/users/schemas";

const staff = {
  email: "New.Person@Tan90.local ",
  fullName: " New Person ",
  role: "WAREHOUSE",
  password: "a-good-password",
  locationId: "loc-wh-blr",
  customerId: null,
  customerName: null,
} as const;

describe("createUserSchema", () => {
  it("accepts a staff member and tidies the input", () => {
    const parsed = createUserSchema.parse(staff);
    expect(parsed.email).toBe("new.person@tan90.local");
    expect(parsed.fullName).toBe("New Person");
  });

  it("needs a location for roles tied to one", () => {
    for (const role of ["WAREHOUSE", "PACKING_WORKER", "FREEZING_STATION_MANAGER"] as const) {
      expect(createUserSchema.safeParse({ ...staff, role, locationId: null }).success).toBe(false);
    }
    expect(createUserSchema.safeParse({ ...staff, role: "DRIVER", locationId: null }).success).toBe(true);
  });

  it("needs a customer for a customer user, existing or new", () => {
    const customer = { ...staff, role: "CUSTOMER", locationId: null } as const;
    expect(createUserSchema.safeParse(customer).success).toBe(false);
    expect(createUserSchema.safeParse({ ...customer, customerId: "cust-1" }).success).toBe(true);
    expect(createUserSchema.safeParse({ ...customer, customerName: "Acme" }).success).toBe(true);
  });

  it.each(["short", "x".repeat(73), "é".repeat(37)])("rejects the password %#", (password) => {
    expect(createUserSchema.safeParse({ ...staff, password }).success).toBe(false);
  });

  it("rejects an unknown role and a bad email", () => {
    expect(createUserSchema.safeParse({ ...staff, role: "ROOT" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...staff, email: "not-an-email" }).success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("requires a name", () => {
    const base = { id: "usr-1", fullName: "A", role: "DRIVER", locationId: null, isActive: true } as const;
    expect(updateUserSchema.safeParse(base).success).toBe(true);
    expect(updateUserSchema.safeParse({ ...base, fullName: " " }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("applies the same password rules", () => {
    expect(resetPasswordSchema.safeParse({ id: "usr-1", newPassword: "long-enough-1" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ id: "usr-1", newPassword: "short" }).success).toBe(false);
  });
});
