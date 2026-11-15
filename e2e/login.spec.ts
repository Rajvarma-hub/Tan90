import { expect, test } from "@playwright/test";
import { PASSWORD, createStaffUser, signIn, signInAndWait } from "./helpers";

// These tests start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

test("signed-out visitors are sent to sign in, then back", async ({ page }) => {
  await page.goto("/exceptions");
  await expect(page).toHaveURL(/\/login\?next=%2Fexceptions$/);

  await page.getByLabel("Email").fill("ops@tan90.local");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/exceptions$/);
  await expect(page.getByRole("heading", { name: "Exceptions", level: 1 })).toBeVisible();
});

test("a wrong password is refused", async ({ page }) => {
  await signIn(page, "ops@tan90.local", "not-the-password");
  await expect(page.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");
  await expect(page).toHaveURL(/\/login/);
});

test("signing out ends the session", async ({ page, request }) => {
  // A throwaway account: signing out ends every session of the account, and the other tests share Ops.
  await signInAndWait(page, await createStaffUser(request, "signout"));
  await expect(page.getByText("Warehouse", { exact: true })).toBeVisible();
  const stale = (await page.context().cookies()).find((c) => c.name === "tan90_session")!;

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login\?next=%2Forders$/);

  // A copy of the old cookie is refused by the API, not just removed from this browser.
  await page.context().addCookies([stale]);
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login\?reason=expired/);
});

test("an account locks after repeated wrong passwords", async ({ page, request }) => {
  const email = await createStaffUser(request, "lock");
  for (let attempt = 0; attempt < 4; attempt++) {
    await signIn(page, email, "wrong-password");
    await expect(page.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");
  }
  await signIn(page, email, "wrong-password");
  await expect(page.locator("form").getByRole("alert")).toContainText("Too many failed attempts");
  await signIn(page, email);
  await expect(page.locator("form").getByRole("alert")).toContainText("Too many failed attempts");
});

test("a password can be changed from the account page", async ({ page, request }) => {
  const email = await createStaffUser(request, "password");
  await signInAndWait(page, email);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Account", level: 1 })).toBeVisible();

  await page.getByLabel("Current password").fill("not-my-password");
  await page.getByLabel(/^New password/).fill("a-new-password-1");
  await page.getByLabel("Repeat new password").fill("a-new-password-1");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Current password is incorrect");

  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Password changed");
  // The session that made the change stays signed in.
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, email, PASSWORD);
  await expect(page.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");
  await signInAndWait(page, email, "a-new-password-1");
});

test.describe("a packing worker", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndWait(page, "packer1@tan90.local");
  });

  test("is not offered Ops actions", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Order" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Exceptions", exact: true })).toBeHidden();
  });

  test("sees no access on a page the API refuses", async ({ page }) => {
    await page.goto("/exceptions");
    await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  });
});
