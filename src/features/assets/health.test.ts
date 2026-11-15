import { describe, expect, it } from "vitest";
import {
  healthCounts,
  healthOf,
  matchesHealth,
  needsAttention,
} from "@/features/assets/health";

describe("healthOf", () => {
  it.each([
    ["UNDER_INSPECTION", "inspection"],
    ["DAMAGED", "damaged"],
    ["QUARANTINED", "quarantined"],
    ["MISSING", "missing"],
    ["RETIRED", "retired"],
    ["AVAILABLE", "healthy"],
    ["WITH_CUSTOMER", "healthy"],
  ])("%s is %s", (status, health) => {
    expect(healthOf(status)).toBe(health);
  });
});

describe("matchesHealth", () => {
  it("hides unregistered containers from the default view", () => {
    expect(matchesHealth("RETIRED", "")).toBe(false);
    expect(matchesHealth("AVAILABLE", "")).toBe(true);
  });

  it("groups the problem states under attention", () => {
    for (const status of ["DAMAGED", "QUARANTINED", "MISSING"]) {
      expect(matchesHealth(status, "attention")).toBe(true);
    }
    expect(matchesHealth("UNDER_INSPECTION", "attention")).toBe(false);
    expect(needsAttention("healthy")).toBe(false);
  });
});

describe("healthCounts", () => {
  it("counts every health value, including empty ones", () => {
    const counts = healthCounts([
      { status: "AVAILABLE" },
      { status: "PACKED" },
      { status: "DAMAGED" },
    ]);
    expect(counts).toEqual({
      healthy: 2,
      inspection: 0,
      damaged: 1,
      quarantined: 0,
      missing: 0,
      retired: 0,
    });
  });
});
