import type { Bindings } from "./src/bindings";

// Merges our real Worker bindings into the pool's `ProvidedEnv`, so
// `env.DB`/`env.RECEIPTS`/etc. in tests are typed exactly like `c.env` in
// route handlers — plus the one test-only extra, the migrations array
// vitest.config.ts injects for vitest.setup.ts to apply.
declare module "cloudflare:test" {
  interface ProvidedEnv extends Bindings {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
