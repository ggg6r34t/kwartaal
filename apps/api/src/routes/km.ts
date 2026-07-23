import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { createKmEntrySchema, newId } from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";
import { kmEntryDto } from "../lib/dto-vault";

/** Stub table per locked decision #9 (no route/mileage computation, just a logged row). */
export const km = new Hono<AppEnv>();

km.get("/", async (c) => {
  const tenantDb = c.get("tenantDb");
  const year = c.req.query("year");
  const rows = await tenantDb.select(schema.kmEntries);
  const filtered = year ? rows.filter((r) => r.date.startsWith(`${year}-`)) : rows;
  return c.json(filtered.map(kmEntryDto));
});

km.post("/", requireRole("owner"), zValidator("json", createKmEntrySchema), async (c) => {
  const tenantDb = c.get("tenantDb");
  const body = c.req.valid("json");
  const id = newId("kmEntry");
  await tenantDb.insert(schema.kmEntries, {
    id,
    date: body.date,
    km: body.km,
    purpose: body.purpose,
  });
  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "km-entry.created",
    target: id,
  });
  const [row] = await tenantDb.select(schema.kmEntries, eq(schema.kmEntries.id, id));
  return c.json(kmEntryDto(row!), 201);
});
