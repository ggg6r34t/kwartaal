import { defineConfig, devices } from "@playwright/test";

/**
 * Self-contained accessibility gate — axe-core against the built marketing
 * site, with no dependency on any external product, account, or service
 * (KWARTAAL-BUILD-PLAN.md's "Self-accessibility" requirement: 0 critical
 * issues, enforced in CI). Deliberately separate from playwright.config.ts:
 * the marketing pages are static prerendered output with no API calls, so
 * this only needs `vite preview` serving `apps/web/dist` — not the full
 * `wrangler dev` + `vite dev` stack the app-flow/visual-pass suite needs.
 * Run `npm run build:web` first; this does not build it itself.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /accessibility\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview -w @kwartaal/web -- --port 4173 --strictPort",
    cwd: "..",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
