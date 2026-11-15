import { describe, expect, it } from "vitest";
import { paginate } from "@/components/ui/pagination";

const items = Array.from({ length: 25 }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns ten rows a page", () => {
    const { rows, pageCount } = paginate(items, 1);
    expect(rows).toEqual(items.slice(0, 10));
    expect(pageCount).toBe(3);
  });

  it("returns the remainder on the last page", () => {
    expect(paginate(items, 3).rows).toEqual([21, 22, 23, 24, 25]);
  });

  it("clamps a page that a filter has made too high", () => {
    const result = paginate(items.slice(0, 5), 4);
    expect(result.page).toBe(1);
    expect(result.rows).toHaveLength(5);
  });

  it("has one empty page for an empty list", () => {
    expect(paginate([], 1)).toEqual({ page: 1, pageCount: 1, rows: [] });
  });
});
