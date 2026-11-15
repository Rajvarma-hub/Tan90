import { test as setup } from "@playwright/test";
import { signInAndWait } from "./helpers";

export const OPS_STATE = "e2e/.auth/ops.json";

setup("sign in as Ops", async ({ page }) => {
  await signInAndWait(page, "ops@tan90.local");
  await page.context().storageState({ path: OPS_STATE });
});
