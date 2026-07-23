import path from "node:path";
import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

/**
 * Pillar 6: real D1/R2/Queues bindings under actual workerd (not a Node
 * mock), needed for the tenant-isolation, bookkeeper-role, and reminder-
 * idempotency tests the plan's Definition of Done requires "by test," not
 * by manual smoke test. Every pre-Pillar-6 test in this package already
 * only used Web-standard APIs (Web Crypto, fetch, Hono) specifically
 * because the whole codebase targets Workers — none needed a Node
 * environment, so moving the whole package onto this pool changes nothing
 * about how they run, only what's now available to write new tests against.
 */
export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, "../../packages/db/migrations");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ["./vitest.setup.ts"],
      poolOptions: {
        workers: {
          // Running one Miniflare/workerd instance per test file in
          // parallel is flaky on Windows in this environment (the
          // module-loading fallback service intermittently refuses
          // loopback connections under concurrent instances) —
          // singleWorker trades some speed for reliability.
          singleWorker: true,
          // Per-test storage snapshot/restore (the default) hits a
          // Windows-specific file-locking race in Miniflare's local R2
          // emulation whenever a test deletes an R2 object (see
          // backup-and-deletion.test.ts's hard-delete-sweep tests) —
          // "Isolated storage failed... EBUSY... unlink ...sqlite" at
          // teardown, even though the test's own assertions all pass
          // first. Every test in this suite already creates its own
          // uniquely-emailed org rather than relying on a clean slate, so
          // turning isolation off (state persists across tests within
          // this shared instance, same as singleWorker already implies
          // for D1) doesn't change what any test can observe.
          isolatedStorage: false,
          wrangler: { configPath: "./wrangler.test.toml" },
          miniflare: {
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
