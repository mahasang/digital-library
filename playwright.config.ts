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
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Login rate limit is 10 attempts / 15 min / IP (login/actions.ts), so roles
  // sign in once in "setup" and specs reuse e2e/.auth/<role>.json. Tests that
  // end the session server-side (logout signs out globally) are tagged
  // @destructive and run last in their own project.
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      grepInvert: /@destructive/,
      dependencies: ["setup"],
    },
    {
      name: "destructive",
      testIgnore: /auth\.setup\.ts/,
      grep: /@destructive/,
      dependencies: ["setup"],
    },
  ],
  // webServer: process.env.E2E_BASE_URL
  //   ? undefined
  //   : {
  //       command: "npm run build && npm run start",
  //       url: "http://localhost:3001",
  //       reuseExistingServer: true,
  //       timeout: 60_000,
  //     },
  webServer: process.env.E2E_BASE_URL
  ? undefined
  : {
      command: "npm run build && npm run start",
      url: "http://localhost:3001",
      // Opt-in only: by default a server already listening on 3001 makes Playwright
      // fail instead of silently testing a stale build. Set E2E_REUSE_SERVER=1 to
      // reuse it (skips build+start). The cold build alone can exceed 120 s.
      reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
      timeout: 300_000,
    },
});
