import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { createHoursEntrySchema, newId } from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";
import { hoursEntryDto } from "../lib/dto-vault";

export const hours = new Hono<AppEnv>();

hours.get("/", async (c) => {
  const tenantDb = c.get("tenantDb");
  const year = c.req.query("year");
  const rows = await tenantDb.select(schema.hoursEntries);
  const filtered = year ? rows.filter((r) => r.date.startsWith(`${year}-`)) : rows;
  return c.json(filtered.map(hoursEntryDto));
});

hours.post(
  "/",
  requireRole("owner"),
  zValidator("json", createHoursEntrySchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const body = c.req.valid("json");
    const id = newId("hoursEntry");
    await tenantDb.insert(schema.hoursEntries, {
      id,
      date: body.date,
      hours: body.hours,
      note: body.note,
    });
    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "hours-entry.created",
      target: id,
    });
    const [row] = await tenantDb.select(
      schema.hoursEntries,
      eq(schema.hoursEntries.id, id),
    );
    return c.json(hoursEntryDto(row!), 201);
  },
);

hours.delete("/:id", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const id = c.req.param("id");
  await tenantDb.delete(schema.hoursEntries, eq(schema.hoursEntries.id, id));
  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "hours-entry.deleted",
    target: id,
  });
  return c.body(null, 204);
});
