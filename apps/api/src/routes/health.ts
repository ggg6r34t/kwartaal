import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
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

/**
 * `referenceData` catches exactly the class of defect that shipped an
 * empty Glossary to production: migrations applying cleanly says nothing
 * about whether `packages/db/seed-reference-data.sql` (global reference
 * data — glossary terms, tax figures — required in every environment,
 * unlike the Maya demo seed) was ever run there. An empty glossary is a
 * deploy defect, not a valid ready state.
 */
health.get("/ready", async (c) => {
  const db = c.get("db");
  try {
    await db.run(sql`select 1`);
    const [term] = await db.select().from(schema.glossaryTerms).limit(1);
    const referenceData = !!term;
    return c.json(
      { ready: referenceData, checks: { database: true, referenceData } },
      referenceData ? 200 : 503,
    );
  } catch {
    return c.json(
      { ready: false, checks: { database: false, referenceData: false } },
      503,
    );
  }
});
