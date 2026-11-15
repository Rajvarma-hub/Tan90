import type { Role } from "@/lib/permissions";

// Shape of GET /api/admin/users.
export type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  location_id: string | null;
  location_code: string | null;
  location_name: string | null;
  created_at: string | null;
  customer_id: string | null;
  customer_name: string | null;
  is_active: boolean;
  locked: boolean;
};

export type UserFormOptions = {
  locations: { id: string; label: string }[];
  customers: { id: string; label: string }[];
};
