import { expect, test } from "@playwright/test";

test.describe("navigation", () => {
  test("opens on the orders list", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });

  for (const [link, heading] of [
    ["Containers", "Containers"],
    ["Deliveries", "Deliveries"],
    ["Exceptions", "Exceptions"],
  ]) {
    test(`sidebar opens ${link}`, async ({ page }) => {
      await page.goto("/orders");
      await page.getByRole("link", { name: link, exact: true }).first().click();
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    });
  }
});

test.describe("orders list", () => {
  test("search narrows the table", async ({ page }) => {
    await page.goto("/orders");
    const rows = page.getByRole("row");
    await expect(rows.nth(1)).toBeVisible(); // the table streams in after the page loads
    const before = await rows.count();
    await page.getByPlaceholder(/Search by order/).fill("zzz-no-such-order");
    await expect.poll(() => rows.count()).toBeLessThan(before);
  });
});
