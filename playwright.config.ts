import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // The tests share one seeded database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/ops.json" },
      dependencies: ["setup"],
    },
  ],
  // Locally this reuses the servers you already run. In CI it starts both.
  webServer: [
    {
      command: process.env.E2E_API_COMMAND ?? "python -m uvicorn app.main:app --port 8001",
      cwd: "./backend",
      url: "http://127.0.0.1:8001/health",
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: isCI ? "npm run start" : "npm run dev",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
