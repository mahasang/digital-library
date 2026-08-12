import { defineConfig } from "@playwright/test";
import "./test/setup-env";

/**
 * Config for the accessibility regression suite only (Hallmark Audit Phase
 * 5). The rest of the project's automated tests are Vitest unit/integration
 * tests (see vitest.config.ts) — this is a separate, browser-based suite
 * because axe-core's contrast/focus checks need real layout and computed
 * styles, which jsdom cannot produce.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3001",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
