import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../bindings";

export const health = new Hono<AppEnv>();

// Public, meant for deploy gates. Uses the raw db (not TenantDb) — health
// checks are one of the sanctioned `.global`-equivalent exceptions.
health.get("/", (c) => {
  return c.json({
    ok: true,
    service: "kwartaal-api",
    environment: c.env.ENVIRONMENT,
  });
});

health.get("/ready", async (c) => {
  const db = c.get("db");
  try {
    await db.run(sql`select 1`);
    return c.json({ ready: true, checks: { database: true } });
  } catch {
    return c.json({ ready: false, checks: { database: false } }, 503);
  }
});
