import { defineConfig, devices } from "@playwright/test";

/**
 * Real browser e2e against the actual dev stack — `wrangler dev` (API,
 * :8787) fronted by Vite's dev proxy (web, :5173), the same pairing
 * apps/web/vite.config.ts documents for local dev. Not the
 * vitest-pool-workers integration harness (apps/api/vitest.config.ts) —
 * that proves server-side correctness against real D1/R2 under workerd;
 * this proves the browser can actually complete each flow through real
 * rendered screens.
 */
export default defineConfig({
  testDir: "./tests",
  // accessibility.spec.ts runs under its own config (playwright.a11y.config.ts)
  // against `vite preview`, not this dev-stack webServer pair.
  testIgnore: /accessibility\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // --test-scheduled exposes the local /__scheduled?cron=... endpoint
      // (wrangler's own dev-only feature) so the reminder-email flow can
      // fire a real cron tick without waiting for the wall clock.
      // wrangler.e2e.toml mirrors the default env minus [browser] — see
      // that file's own comment for why it can't be the real wrangler.toml.
      command: "npx wrangler dev --config wrangler.e2e.toml --test-scheduled",
      cwd: "../apps/api",
      url: "http://localhost:8787/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run dev -w @kwartaal/web",
      cwd: "..",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
