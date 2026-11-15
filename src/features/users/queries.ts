import "server-only";
import { backend } from "@/server/backend";
import type { ManagedUser, UserFormOptions } from "@/features/users/types";

type ApiLocation = { id: string; code: string; name: string; is_active: boolean };
type ApiCustomer = { id: string; name: string };

export async function getUsersPage(): Promise<{ users: ManagedUser[]; options: UserFormOptions }> {
  const [users, locations, customers] = await Promise.all([
    backend<ManagedUser[]>("/api/admin/users"),
    backend<ApiLocation[]>("/api/stations"),
    backend<ApiCustomer[]>("/api/customers"),
  ]);
  return {
    users,
    options: {
      locations: locations
        .filter((location) => location.is_active)
        .map((location) => ({ id: location.id, label: `${location.code} · ${location.name}` })),
      customers: customers.map((customer) => ({ id: customer.id, label: customer.name })),
    },
  };
}
