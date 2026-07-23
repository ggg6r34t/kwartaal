import { beforeEach } from "vitest";
import { applyD1Migrations, env } from "cloudflare:test";

// Runs once before the test file's own module graph executes, against the
// real (empty) D1 instance Miniflare provisions per test file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

/**
 * isolatedStorage is off (see vitest.config.ts) — D1/R2 state persists
 * across every test in the run, not just within a file. Every test already
 * uses its own uniquely-emailed org, so that's harmless almost everywhere
 * except the IP-keyed rate limiter (middleware/rate-limit.ts): all
 * SELF.fetch calls share the same synthetic IP, so its counters would
 * otherwise accumulate across unrelated tests and start 429-ing real
 * sign-ups partway through the suite.
 */
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM rate_limits").run();
});
