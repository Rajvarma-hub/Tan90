import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { can, isRole, type Permission, type Role } from "@/lib/permissions";
import { backend } from "@/server/backend";

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  location_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
};

// One /me call per request, however many components ask.
export const getCurrentUser = cache(async (): Promise<SessionUser> => {
  const user = await backend<SessionUser>("/api/auth/me");
  if (!isRole(user.role)) redirect("/login?reason=forbidden");
  return user;
});

export async function hasPermission(permission: Permission): Promise<boolean> {
  return can((await getCurrentUser()).role, permission);
}
