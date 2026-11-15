import { expect, test } from "@playwright/test";
import { createDispatchedOrder, signInAndWait } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test("the bell tells a customer about their order and clears when read", async ({ page, request }) => {
  const order = await createDispatchedOrder(request);
  await signInAndWait(page, "blinkit@tan90.local");
  await page.goto("/orders");

  const bell = page.getByRole("button", { name: /^Notifications, \d+ unread$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText(`Your order ${order.number} is on its way`)).toBeVisible();

  // Opening one goes to its order and counts it as read.
  const before = Number((await bell.getAttribute("aria-label"))!.match(/\d+/)![0]);
  await panel.getByText(`Your order ${order.number} is on its way`).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${order.id}$`));
  await expect(page.getByRole("button", { name: `Notifications, ${before - 1} unread` })).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible();
  await expect(page.getByText(`Your order ${order.number} was approved`)).toBeVisible();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  await expect(page.getByText("0 unread of")).toBeVisible();
});

test("a driver is told when a delivery is assigned", async ({ page, request }) => {
  await createDispatchedOrder(request);
  await signInAndWait(page, "driver1@tan90.local");
  await page.goto("/notifications");
  await expect(page.getByText(/You have a delivery: ORD-/).first()).toBeVisible();
});
