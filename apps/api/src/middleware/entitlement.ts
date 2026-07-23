import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../bindings";
import { computeEntitlement } from "../lib/entitlement";

/**
 * The feature gate itself (locked decision #5): Free tier keeps read access
 * to everything (calendar, glossary, and — this is the "trial data stays
 * read-only, never deleted" promise — every record made during the trial),
 * so this only ever blocks mutations. GET requests always pass through.
 * Mounted once per gated router group in index.ts rather than touching
 * every individual route handler.
 */
export const requireProForMutations = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === "GET") return next();

  const tenantDb = c.get("tenantDb");
  const entitled = await computeEntitlement(tenantDb);
  if (!entitled) {
    return c.json({ error: "pro-required" }, 402);
  }
  await next();
});
