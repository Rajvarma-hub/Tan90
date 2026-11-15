import { expect, test, type Browser } from "@playwright/test";
import { apiToken, post, signIn, signInAndWait } from "./helpers";

test("Ops add a driver, who can then sign in, and reset their password", async ({ page, browser }) => {
  const email = `e2e-driver-${Date.now()}@tan90.local`;
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  // Admin accounts are not Ops' to change.
  const search = page.getByPlaceholder("Search name, email, customer, location…");
  await search.fill("admin@tan90.local");
  await expect(page.getByRole("row", { name: /admin@tan90\.local/ }).getByText("Super admin only")).toBeVisible();
  await search.clear();

  await page.getByRole("button", { name: "Add User" }).click();
  const add = page.getByRole("dialog", { name: "Add User" });
  await add.getByLabel("Full name").fill("E2E Driver");
  await add.getByLabel("Email").fill(email);
  await expect(add.getByLabel("Role").locator("option", { hasText: "Super admin" })).toHaveCount(0);
  await add.getByRole("button", { name: "Generate" }).click();
  const password = await add.getByLabel("First password").inputValue();
  expect(password).toHaveLength(12);
  await add.getByRole("button", { name: "Create User" }).click();
  await expect(add.getByRole("status")).toContainText(`Created ${email}`);
  await add.getByRole("button", { name: "Done" }).click();

  // The new driver signs in with it.
  const driver = await signedIn(browser, email, password);
  await expect(driver.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();

  // Ops reset the password; the old one stops working and the open session ends.
  await page.getByPlaceholder("Search name, email, customer, location…").fill(email);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  const reset = page.getByRole("dialog", { name: "Reset Password" });
  await reset.getByRole("button", { name: "Generate" }).click();
  const next = await reset.getByLabel("New password").inputValue();
  await reset.getByRole("button", { name: "Reset Password" }).click();
  await expect(reset.getByRole("status")).toContainText("Password reset");
  await reset.getByRole("button", { name: "Done" }).click();

  await driver.reload();
  await expect(driver).toHaveURL(/\/login/);
  await signIn(driver, email, password);
  await expect(driver.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");
  await signInAndWait(driver, email, next);

  // Deactivating ends the session too.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit User" });
  await edit.getByLabel("Active").uncheck();
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: new RegExp(email) }).getByText("Inactive")).toBeVisible();
  await driver.reload();
  await expect(driver).toHaveURL(/\/login/);
  await driver.context().close();
});

test("a station manager cannot manage users", async ({ browser }) => {
  const page = await signedIn(browser, "fsblr@tan90.local");
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users", exact: true })).toBeHidden();
  await page.context().close();
});

test("Ops edit a product and a location", async ({ page, request }) => {
  const ops = await apiToken(request, "ops@tan90.local");
  const stamp = Date.now();
  const sku = `E2E-${stamp}`;
  await post(request, "/api/products", ops, { sku, name: "E2E panel", setpoint_c: -20 }, 201);
  const code = `E2E-${String(stamp).slice(-8)}`;
  await post(request, "/api/stations", ops, { code, name: "E2E hub", kind: "WAREHOUSE", address: "Old road" }, 201);

  await page.goto("/inventory/assets");
  await page.getByPlaceholder("Search name, SKU, category…").fill(sku);
  await page.getByRole("row", { name: new RegExp(sku) }).getByRole("button", { name: "Edit" }).click();
  const product = page.getByRole("dialog", { name: "Edit Product" });
  await product.getByLabel("Name").fill("E2E panel renamed");
  await product.getByLabel("Setpoint (°C)").fill("-24");
  await product.getByLabel(/Available to order/).uncheck();
  await product.getByRole("button", { name: "Save" }).click();
  const row = page.getByRole("row", { name: new RegExp(sku) });
  await expect(row.getByText("E2E panel renamed")).toBeVisible();
  await expect(row.getByText("Not orderable")).toBeVisible();
  await expect(row.getByText("-24 °C")).toBeVisible();

  await page.goto("/inventory/stations");
  await page.getByPlaceholder("Search code, name, address…").fill(code);
  await page.getByRole("button", { name: "Edit" }).click();
  const location = page.getByRole("dialog", { name: "Edit Location" });
  await location.getByLabel("Address").fill("New road 9");
  await location.getByLabel(/Online/).uncheck();
  await location.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("New road 9")).toBeVisible();
  await expect(page.getByText("Offline")).toBeVisible();
});

async function signedIn(browser: Browser, email: string, password = "password123") {
  const context = await browser.newContext({ baseURL: "http://localhost:3000", storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await signInAndWait(page, email, password);
  return page;
}
