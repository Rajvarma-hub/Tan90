// Mirrors the role checks in the API (backend/app/routers). The API is what enforces them;
// this only decides what the portal shows, so a user is not offered buttons that would be refused.

export const roles = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "FREEZING_STATION_MANAGER",
  "WAREHOUSE",
  "PACKING_WORKER",
  "SUPPLY_CHAIN_MANAGER",
  "DRIVER",
  "CUSTOMER",
] as const;

export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  OPERATIONS_ADMIN: "Operations admin",
  FREEZING_STATION_MANAGER: "Freezing station manager",
  WAREHOUSE: "Warehouse",
  PACKING_WORKER: "Packing worker",
  SUPPLY_CHAIN_MANAGER: "Supply chain manager",
  DRIVER: "Driver",
  CUSTOMER: "Customer",
};

const SA = "SUPER_ADMIN";
const OA = "OPERATIONS_ADMIN";
const FSM = "FREEZING_STATION_MANAGER";
const WH = "WAREHOUSE";
const PW = "PACKING_WORKER";
const SCM = "SUPPLY_CHAIN_MANAGER";
const DR = "DRIVER";
const CU = "CUSTOMER";

// Everyone who works inside the operation. Drivers and customers only see their own orders.
export const STAFF_ROLES: readonly Role[] = [SA, OA, FSM, WH, PW, SCM];

const grants = {
  // Operation-wide screens: all containers, stock, stations. Not for drivers or customers.
  "staff.view": STAFF_ROLES,
  "containers.mine": [CU],

  // Pages the API restricts beyond "any signed-in staff".
  "deliveries.view": [SA, OA, SCM],
  "exceptions.view": [SA, OA, FSM, SCM],

  "orders.create": [SA, OA, CU],
  "orders.approve": [SA, OA], // approve and cancel
  "orders.pack": [SA, OA, FSM, PW],
  "orders.dispatch": [SA, OA, FSM, PW],
  "orders.transit": [SA, OA, DR], // depart, arrive, deliver
  "delivery.show_code": [SA, OA, DR], // the code the customer scans on arrival
  "delivery.verify": [CU],
  "delivery.share_location": [DR], // the phone reports the vehicle's position
  "orders.confirm_receipt": [SA, OA, CU],
  "orders.request_return": [SA, OA, CU],
  "orders.collect_return": [SA, OA, DR],
  "orders.process_return": [SA, OA, FSM], // assign driver, receive, inspect

  "containers.register": [SA, OA, FSM, WH, PW],
  "containers.manage": [SA, OA, FSM], // edit, replace tag, unregister, restore

  "inventory.move": [SA, OA, FSM, WH],
  "catalog.manage": [SA, OA], // add or edit a product or location
  "users.manage": [SA, OA], // add, edit and reset people
  "exceptions.resolve": [SA, OA],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof grants;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (grants[permission] as readonly Role[]).includes(role);
}

// Accounts that can themselves manage users. Only a super admin may create, edit or reset them.
const ADMIN_ROLES: readonly Role[] = [SA, OA];

// These roles work at one location and need it assigned.
export const STATION_ROLES: readonly Role[] = [FSM, WH, PW];

/** Mirrors the API: whether someone in `viewer` may create, edit or reset an account with `target`. */
export function canManageRole(viewer: Role | null | undefined, target: Role): boolean {
  if (viewer === SA) return true;
  return viewer === OA && !ADMIN_ROLES.includes(target);
}

export function isRole(role: string): role is Role {
  return (roles as readonly string[]).includes(role);
}
