import { defineConfig, devices } from "@playwright/test";

/**
 * Targets the real, deployed staging.kwartaal.app — no local wrangler dev/
 * vite dev, no webServer block, nothing to spin up. Deliberately scoped to
 * staging-smoke.spec.ts only: the rest of the suite (auth-flows.spec.ts,
 * reminder-email.spec.ts, etc.) reads/writes the local D1 file directly via
 * helpers.ts's d1Execute/d1QueryFirst (`wrangler d1 execute ... --local`),
 * which has no equivalent against a real remote D1 without either
 * `--remote` (mutates real staging data) or the Cloudflare D1 REST API —
 * out of scope here. This config exists to prove the live cutover itself
 * (DNS + Pages custom domain + same-origin proxy) actually works end to
 * end against the real hostname, not to duplicate the full local suite.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /staging-smoke\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: "https://staging.kwartaal.app",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
