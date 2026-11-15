import { describe, expect, it } from "vitest";
import { breadcrumbsFor, isActivePath, isChildActive, mainNav } from "@/config/navigation";

describe("isActivePath", () => {
  it("matches the path and its children, not lookalikes", () => {
    expect(isActivePath("/orders", "/orders")).toBe(true);
    expect(isActivePath("/orders/ord-1", "/orders")).toBe(true);
    expect(isActivePath("/orders-archive", "/orders")).toBe(false);
  });
});

describe("isChildActive", () => {
  const containers = mainNav.find((item) => item.title === "Containers")!;
  const children = containers.children!;
  const [all, byLocation] = children;

  it("selects a view by its query", () => {
    expect(isChildActive("/assets", "locations", byLocation, children)).toBe(true);
    expect(isChildActive("/assets", null, byLocation, children)).toBe(false);
  });

  it("selects the base item only when no view is chosen", () => {
    expect(isChildActive("/assets", null, all, children)).toBe(true);
    expect(isChildActive("/assets", "locations", all, children)).toBe(false);
  });
});

describe("breadcrumbsFor", () => {
  it("uses nav titles and marks unknown segments dynamic", () => {
    expect(breadcrumbsFor("/orders/ord-1")).toEqual([
      { title: "Orders", href: "/orders", dynamic: false },
      { title: "ord-1", href: "/orders/ord-1", dynamic: true },
    ]);
  });

  it("adds a crumb for a ?view= sub-section", () => {
    const crumbs = breadcrumbsFor("/assets", "attention");
    expect(crumbs.map((crumb) => crumb.title)).toEqual(["Containers", "Needs attention"]);
  });
});
