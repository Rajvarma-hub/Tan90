"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type Permission, type Role } from "@/lib/permissions";

export type CurrentUser = { id: string; fullName: string; email: string; role: Role };

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return <UserContext value={user}>{children}</UserContext>;
}

export function useUser(): CurrentUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used inside the portal shell");
  return user;
}

export function useCan(): (permission: Permission) => boolean {
  const { role } = useUser();
  return (permission) => can(role, permission);
}

/** Shows its children only to roles the API lets perform this. */
export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  return useCan()(permission) ? children : null;
}
