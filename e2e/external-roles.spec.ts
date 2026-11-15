import { expect, test, type Browser } from "@playwright/test";
import { createDispatchedOrder, signInAndWait } from "./helpers";

// Each test signs in as the person it is about.
test.use({ storageState: { cookies: [], origins: [] } });

async function signedInPage(browser: Browser, email: string) {
  const context = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await signInAndWait(page, email);
  return page;
}

test("a customer sees their own orders and nothing of the operation", async ({ page }) => {
  await signInAndWait(page, "blinkit@tan90.local");
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Order" })).toBeVisible();
  // Their own order is listed; another customer's is not.
  await expect(page.getByRole("link", { name: "ORD-0007" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ORD-0001" })).toBeHidden();

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "My containers" })).toBeVisible();
  for (const name of ["Inventory", "Containers", "Asset Management", "Exceptions"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeHidden();
  }

  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  await page.goto("/my-containers");
  await expect(page.getByRole("heading", { name: "My containers", level: 1 })).toBeVisible();
});

test("a customer can place an order without choosing a customer", async ({ page }) => {
  await signInAndWait(page, "blinkit@tan90.local");
  await page.goto("/orders");
  await page.getByRole("button", { name: "New Order" }).click();
  const dialog = page.getByRole("dialog", { name: "New Order" });
  await expect(dialog.getByLabel("Customer")).toBeHidden();
  await dialog.getByLabel("Product").selectOption({ index: 1 });
  await dialog.getByPlaceholder("Warehouse or dark store").fill("E2E customer order");
  await dialog.getByRole("button", { name: "Create Order" }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/);
  await expect(page.getByText("Pending approval").first()).toBeVisible();
});

test("a driver sees only the orders assigned to them", async ({ page }) => {
  await signInAndWait(page, "driver1@tan90.local");
  await page.goto("/orders");
  await expect(page.getByRole("link", { name: "ORD-0005" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ORD-0001" })).toBeHidden();
  await expect(page.getByRole("button", { name: "New Order" })).toBeHidden();

  await page.goto("/assets");
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
});

test("a delivery is verified with the driver's code, then confirmed by the customer", async ({
  browser,
  request,
}) => {
  const order = await createDispatchedOrder(request);
  const driver = await signedInPage(browser, "driver1@tan90.local");
  const customer = await signedInPage(browser, "blinkit@tan90.local");

  // The driver sets off, arrives and gets a code to show.
  await driver.goto(`/orders/${order.id}`);
  await driver.getByRole("button", { name: "Mark Departed" }).click();
  await driver.getByRole("button", { name: "Mark Arrived" }).click();
  await expect(driver.getByRole("heading", { name: "Delivery code" })).toBeVisible();
  await expect(driver.getByAltText("Delivery QR code")).toBeVisible();
  const code = (
    await driver.getByText("Or read this code out").locator("xpath=following-sibling::p").innerText()
  ).trim();
  expect(code.length).toBeGreaterThan(20);

  // The customer cannot confirm yet. Opening the scanned link fills the code in; a wrong one is refused.
  await customer.goto(`/orders/${order.id}`);
  await expect(customer.getByRole("button", { name: "Confirm Receipt" })).toBeHidden();
  await expect(customer.getByRole("heading", { name: "Delivery code" })).toBeHidden();
  await customer.goto(`/orders/${order.id}?code=not-the-code`);
  const dialog = customer.getByRole("dialog", { name: "Verify Delivery" });
  await expect(dialog.getByLabel("Delivery code")).toHaveValue("not-the-code");
  await dialog.getByRole("button", { name: "Verify" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Invalid delivery code");

  await dialog.getByLabel("Delivery code").fill(code);
  await dialog.getByRole("button", { name: "Verify" }).click();
  await expect(customer.getByText("Delivery verified")).toBeVisible();
  await expect(driver.getByText("Delivery code")).toBeVisible();

  // The driver hands over; now the customer can confirm what arrived.
  await driver.reload();
  await driver.getByRole("button", { name: "Mark Delivered" }).click();
  await expect(driver.getByText("Delivered. Record what the customer received.")).toBeVisible();
  await customer.reload();
  await customer.getByRole("button", { name: "Confirm Receipt" }).click();
  await customer.getByRole("dialog", { name: "Confirm Receipt" }).getByRole("button", { name: "Confirm Receipt" }).click();
  await expect(customer.getByText(/Receipt confirmed/)).toBeVisible();
  await expect(customer.getByRole("button", { name: "Request Return" })).toBeVisible();
});
