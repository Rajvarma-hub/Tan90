import { expect, test, type Browser } from "@playwright/test";
import { apiToken, signInAndWait } from "./helpers";

async function signedIn(browser: Browser, email: string, permissions: string[] = []) {
  const context = await browser.newContext({
    baseURL: "http://localhost:3000",
    storageState: { cookies: [], origins: [] },
    permissions,
    geolocation: { latitude: 12.9352, longitude: 77.6245, accuracy: 15 },
  });
  const page = await context.newPage();
  await signInAndWait(page, email);
  return page;
}

test("products below their reorder level are flagged", async ({ page, request }) => {
  const ops = await apiToken(request, "ops@tan90.local");
  const set = await request.patch("http://127.0.0.1:8001/api/products/prd-pcm-neg50", {
    headers: ops,
    data: { reorder_level: 200 },
  });
  expect(set.ok()).toBe(true);
  await page.goto("/inventory/assets");
  await expect(page.getByText("Low stock", { exact: true }).first()).toBeVisible();
  await page.getByPlaceholder("Search name, SKU, category…").fill("PCM-NEG50");
  await expect(page.getByText("Low · reorder at 200")).toBeVisible();
});

test("a table can be exported as CSV", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.getByRole("row").nth(1)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/);
  const path = await file.path();
  const text = (await import("node:fs")).readFileSync(path, "utf8");
  expect(text).toContain("Order,Customer,Destination");
  expect(text).toContain("ORD-0001");
});

test("a location with work or stock cannot be switched off", async ({ page }) => {
  await page.goto("/inventory/stations");
  await page.getByPlaceholder("Search code, name, address…").fill("FS-BLR");
  await page.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Location" });
  await dialog.getByLabel(/Online/).uncheck();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toContainText("FS-BLR still has");
});

test("the driver shares their location and Ops see it on the order", async ({ browser, request, page }) => {
  const driver = await signedIn(browser, "driver1@tan90.local", ["geolocation"]);
  await driver.goto("/orders");
  await driver.getByRole("link", { name: "ORD-0006" }).click();
  await expect(driver.getByText("Share my location")).toBeVisible();
  await driver.getByRole("button", { name: "Start sharing" }).click();
  await expect(driver.getByText(/Sharing\. Last sent at/)).toBeVisible({ timeout: 20_000 });

  const ops = await apiToken(request, "ops@tan90.local");
  const orders = (await (await request.get("http://127.0.0.1:8001/api/orders", { headers: ops })).json()) as {
    id: string;
    order_number: string;
  }[];
  const orderId = orders.find((o) => o.order_number === "ORD-0006")!.id;
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByRole("heading", { name: "Vehicle location" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in OpenStreetMap" })).toHaveAttribute(
    "href",
    /mlat=12\.93520&mlon=77\.62450/,
  );
  await driver.context().close();
});

test("an ordinary person does not get a share-location button", async ({ browser }) => {
  const customer = await signedIn(browser, "instamart@tan90.local");
  await customer.goto("/orders");
  await customer.getByRole("link", { name: "ORD-0006" }).click();
  await expect(customer.getByRole("heading", { name: "Vehicle location" })).toBeVisible();
  await expect(customer.getByText("Share my location")).toBeHidden();
  await customer.context().close();
});
