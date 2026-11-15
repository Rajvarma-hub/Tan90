import { describe, expect, it } from "vitest";
import {
  STAFF_ROLES,
  STATION_ROLES,
  can,
  canManageRole,
  isRole,
  roles,
  type Permission,
} from "@/lib/permissions";

describe("can", () => {
  it("gives Ops the order steps and a packing worker only packing and dispatch", () => {
    expect(can("OPERATIONS_ADMIN", "orders.approve")).toBe(true);
    expect(can("PACKING_WORKER", "orders.approve")).toBe(false);
    expect(can("PACKING_WORKER", "orders.pack")).toBe(true);
    expect(can("PACKING_WORKER", "orders.dispatch")).toBe(true);
    expect(can("PACKING_WORKER", "orders.create")).toBe(false);
  });

  it("limits station work to the station manager and admins", () => {
    for (const permission of ["orders.process_return", "containers.manage"] as const) {
      expect(can("FREEZING_STATION_MANAGER", permission)).toBe(true);
      expect(can("WAREHOUSE", permission)).toBe(false);
    }
  });

  it("lets the supply chain manager watch but not act", () => {
    expect(can("SUPPLY_CHAIN_MANAGER", "deliveries.view")).toBe(true);
    expect(can("SUPPLY_CHAIN_MANAGER", "exceptions.view")).toBe(true);
    expect(can("SUPPLY_CHAIN_MANAGER", "exceptions.resolve")).toBe(false);
    expect(can("SUPPLY_CHAIN_MANAGER", "orders.approve")).toBe(false);
  });

  it("grants nothing without a role", () => {
    expect(can(null, "orders.create")).toBe(false);
    expect(can(undefined, "orders.create")).toBe(false);
  });

  it("gives a driver the road steps and nothing else", () => {
    for (const permission of [
      "orders.transit",
      "orders.collect_return",
      "delivery.show_code",
    ] as const) {
      expect(can("DRIVER", permission)).toBe(true);
    }
    for (const permission of [
      "staff.view",
      "orders.create",
      "orders.approve",
      "orders.confirm_receipt",
      "delivery.verify",
    ] as const) {
      expect(can("DRIVER", permission)).toBe(false);
    }
  });

  it("gives a customer their own orders, receipt and returns, and no operation screens", () => {
    for (const permission of [
      "orders.create",
      "orders.confirm_receipt",
      "orders.request_return",
      "delivery.verify",
      "containers.mine",
    ] as const) {
      expect(can("CUSTOMER", permission)).toBe(true);
    }
    for (const permission of [
      "staff.view",
      "orders.approve",
      "orders.transit",
      "delivery.show_code",
      "exceptions.view",
      "inventory.move",
    ] as const) {
      expect(can("CUSTOMER", permission)).toBe(false);
    }
  });

  it("keeps operation-wide screens and stock changes away from drivers and customers", () => {
    const staffOnly: Permission[] = [
      "staff.view",
      "orders.approve",
      "orders.pack",
      "orders.dispatch",
      "orders.process_return",
      "containers.register",
      "containers.manage",
      "inventory.move",
      "catalog.manage",
      "exceptions.view",
      "exceptions.resolve",
      "deliveries.view",
    ];
    for (const role of ["DRIVER", "CUSTOMER"] as const) {
      for (const permission of staffOnly) expect(can(role, permission)).toBe(false);
    }
  });
});

describe("STAFF_ROLES", () => {
  it("is every role except drivers and customers", () => {
    expect([...STAFF_ROLES].sort()).toEqual(
      roles.filter((role) => role !== "DRIVER" && role !== "CUSTOMER").sort(),
    );
  });
});

describe("isRole", () => {
  it("recognises every role the API issues", () => {
    for (const role of roles) expect(isRole(role)).toBe(true);
    expect(isRole("ROOT")).toBe(false);
  });
});

describe("canManageRole", () => {
  it("lets a super admin manage anyone", () => {
    for (const role of roles) expect(canManageRole("SUPER_ADMIN", role)).toBe(true);
  });

  it("keeps admin accounts out of Ops hands", () => {
    expect(canManageRole("OPERATIONS_ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(canManageRole("OPERATIONS_ADMIN", "OPERATIONS_ADMIN")).toBe(false);
    expect(canManageRole("OPERATIONS_ADMIN", "DRIVER")).toBe(true);
    expect(canManageRole("OPERATIONS_ADMIN", "CUSTOMER")).toBe(true);
  });

  it("gives everyone else nothing", () => {
    for (const viewer of ["FREEZING_STATION_MANAGER", "DRIVER", "CUSTOMER", null, undefined] as const) {
      expect(canManageRole(viewer, "WAREHOUSE")).toBe(false);
    }
  });

  it("matches who may open user management", () => {
    expect(can("OPERATIONS_ADMIN", "users.manage")).toBe(true);
    expect(can("SUPPLY_CHAIN_MANAGER", "users.manage")).toBe(false);
  });
});

describe("STATION_ROLES", () => {
  it("are the roles tied to one location", () => {
    expect([...STATION_ROLES].sort()).toEqual(
      ["FREEZING_STATION_MANAGER", "PACKING_WORKER", "WAREHOUSE"].sort(),
    );
  });
});
