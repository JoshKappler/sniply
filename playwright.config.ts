import { defineConfig, devices } from "@playwright/test";
import path from "path";

// Tell the API helpers which base URL to use.
// Set before worker processes are spawned so it's inherited by all workers and globalSetup.
process.env.PLAYWRIGHT_BASE_URL = "http://localhost:3001";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  testMatch: "**/*.spec.ts",
  globalSetup: path.join(__dirname, "tests/e2e/global-setup.ts"),
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: "http://localhost:3001",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // Use a production build (webpack) on port 3001.
    // This avoids the Turbopack FATAL crash on /pro/dashboard/page.
    // Port 3001 does not conflict with the local `next dev` server on 3000.
    command: "next build && next start -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000, // 5 min — accounts for next build time
    stdout: "pipe",
    stderr: "pipe",
  },
});
