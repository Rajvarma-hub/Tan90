import { expect, test } from "@playwright/test";

test("place an order, then approve it", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("button", { name: "New Order" }).click();

  const dialog = page.getByRole("dialog", { name: "New Order" });
  await dialog.getByLabel("Customer").selectOption({ index: 1 });
  await dialog.getByLabel("Product").selectOption({ index: 1 });
  await dialog.getByLabel("Quantity").fill("2");
  await dialog.getByPlaceholder("Warehouse or dark store").fill("E2E dock");
  await dialog.getByRole("button", { name: "Create Order" }).click();

  await expect(page).toHaveURL(/\/orders\/[^/]+$/);
  await expect(page.getByText("Waiting for Ops to approve")).toBeVisible();

  await page.getByRole("button", { name: "Approve Order" }).click();
  const approve = page.getByRole("dialog", { name: "Approve Order" });
  await approve.getByLabel("Freezing station").selectOption({ index: 1 });
  await approve.getByRole("button", { name: "Approve", exact: true }).click();

  await expect(page.getByText(/Approved for /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Order" })).toBeHidden();
});
