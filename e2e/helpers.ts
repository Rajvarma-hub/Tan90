import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "password123";

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signInAndWait(page: Page, email: string, password = PASSWORD) {
  await signIn(page, email, password);
  await expect(page).not.toHaveURL(/\/login/);
}

const API = "http://127.0.0.1:8001";

/** A new warehouse user, so tests that lock, sign out or change passwords leave the demo accounts alone. */
export async function createStaffUser(request: APIRequestContext, tag: string) {
  const email = `${tag}-${Date.now()}@tan90.local`;
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email: "ops@tan90.local", password: PASSWORD },
  });
  const { access_token } = (await login.json()) as { access_token: string };
  const created = await request.post(`${API}/api/auth/register`, {
    headers: { Authorization: `Bearer ${access_token}` },
    data: { email, password: PASSWORD, full_name: `E2E ${tag}`, role: "WAREHOUSE", location_id: "loc-wh-blr" },
  });
  expect(created.status()).toBe(201);
  return email;
}

export async function apiToken(request: APIRequestContext, email: string) {
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email, password: PASSWORD },
  });
  const { access_token } = (await login.json()) as { access_token: string };
  return { Authorization: `Bearer ${access_token}` };
}

export async function post(request: APIRequestContext, path: string, headers: Record<string, string>, data?: object, expected = 200) {
  const response = await request.post(`${API}${path}`, { headers, data });
  expect(response.status(), `${path}: ${await response.text()}`).toBe(expected);
  return (await response.json()) as Record<string, string>;
}

/** A new Blinkit order, packed and dispatched with the seeded driver Vikram, ready to depart. */
export async function createDispatchedOrder(request: APIRequestContext) {
  const ops = await apiToken(request, "ops@tan90.local");
  const packer = await apiToken(request, "packer1@tan90.local");
  const customer = await apiToken(request, "blinkit@tan90.local");
  const stamp = Date.now();
  const station = "loc-fs-blr";
  const epcs = [`E280A1${String(stamp).padStart(18, "0")}`, `E280A1${String(stamp + 1).padStart(18, "0")}`];

  const containers = [
    await post(request, "/api/containers", packer, { epc: epcs[0], container_type_code: "SHIP-20", location_id: station }, 201),
    await post(request, "/api/containers", packer, { epc: epcs[1], container_type_code: "SHIP-40", location_id: station }, 201),
  ];
  const order = await post(request, "/api/orders", customer, {
    customer_id: "cust-blinkit",
    station_id: station,
    destination: "E2E dock",
    items: [{ product_id: "prd-pcm-pos5", quantity: 2 }],
  });
  await post(request, `/api/orders/${order.id}/approve`, ops, { station_id: station });
  const session = await post(request, `/api/orders/${order.id}/packing-sessions`, packer);
  await post(request, `/api/packing-sessions/${session.id}/scans`, packer, { epcs });
  for (const container of containers) {
    const response = await request.patch(`${API}/api/packing-sessions/${session.id}/items/${container.id}`, {
      headers: packer,
      data: { contents: [{ sku: "PCM-POS5", qty: 1 }] },
    });
    expect(response.ok()).toBe(true);
  }
  await post(request, `/api/packing-sessions/${session.id}/complete`, packer);
  await post(request, `/api/orders/${order.id}/dispatch`, packer, {
    driver_id: "usr-driver1",
    vehicle_ref: "KA-E2E-0001",
    epcs,
  });
  return { id: order.id, number: order.order_number };
}
