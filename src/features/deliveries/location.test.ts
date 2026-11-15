import { describe, expect, it } from "vitest";
import { mapLinks, recordLocationSchema } from "@/features/deliveries/location";

describe("mapLinks", () => {
  it("centres the embed and the link on the point", () => {
    const { embed, open } = mapLinks(12.9716, 77.5946);
    expect(decodeURIComponent(embed)).toContain("marker=12.97160,77.59460");
    expect(decodeURIComponent(embed)).toContain("bbox=77.58860,12.96560,77.60060,12.97760");
    expect(open).toContain("mlat=12.97160&mlon=77.59460");
    expect(open).toContain("#map=16/12.97160/77.59460");
  });

  it("only points at OpenStreetMap", () => {
    const { embed, open } = mapLinks(-33.9, 151.2);
    expect(embed.startsWith("https://www.openstreetmap.org/")).toBe(true);
    expect(open.startsWith("https://www.openstreetmap.org/")).toBe(true);
  });
});

describe("recordLocationSchema", () => {
  const ok = { taskId: "task-1", latitude: 12.9, longitude: 77.5, accuracyM: 8 };

  it("accepts a real position, with or without an accuracy", () => {
    expect(recordLocationSchema.safeParse(ok).success).toBe(true);
    expect(recordLocationSchema.safeParse({ ...ok, accuracyM: null }).success).toBe(true);
  });

  it.each([
    { latitude: 91 },
    { latitude: -91 },
    { longitude: 181 },
    { accuracyM: -1 },
    { taskId: "" },
  ])("rejects %j", (patch) => {
    expect(recordLocationSchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
});
