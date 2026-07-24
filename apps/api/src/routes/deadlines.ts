import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import type { DeadlineRow } from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";

export const deadlines = new Hono<AppEnv>();

deadlines.get("/", async (c) => {
  const tenantDb = c.get("tenantDb");
  const rows = await tenantDb.select(schema.deadlines);

  const dtos: DeadlineRow[] = rows.map((row) => ({
    id: row.id,
    orgId: row.orgId,
    kind: row.kind as DeadlineRow["kind"],
    dueDate: row.dueDate,
    quarterId: row.quarterId,
    dismissedAt: row.dismissedAt ? row.dismissedAt.getTime() : null,
    sameDayReminderRequestedAt: row.sameDayReminderRequestedAt
      ? row.sameDayReminderRequestedAt.getTime()
      : null,
  }));

  return c.json(dtos);
});

/**
 * "Remind me at my laptop tonight" — pins a same-day 19:00 handoff
 * reminder to this deadline. No new pipeline: the existing hourly cron
 * picks this up once the Amsterdam clock reaches 19:00 on this same
 * calendar day (see scheduled.ts's maybeEnqueueSameDayStage) and sends it
 * through the same reminder_logs-idempotent queue path as every other
 * stage.
 */
deadlines.post("/:id/remind-tonight", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const id = c.req.param("id");

  const [existing] = await tenantDb.select(schema.deadlines, eq(schema.deadlines.id, id));
  if (!existing) return c.json({ error: "deadline-not-found" }, 404);

  await tenantDb.update(
    schema.deadlines,
    { sameDayReminderRequestedAt: new Date() },
    eq(schema.deadlines.id, id),
  );
  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "deadline.remind-tonight.requested",
    target: id,
  });
  return c.json({ ok: true });
});

/** Undo — clears the pending same-day handoff reminder before it fires. */
deadlines.delete("/:id/remind-tonight", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const id = c.req.param("id");

  const [existing] = await tenantDb.select(schema.deadlines, eq(schema.deadlines.id, id));
  if (!existing) return c.json({ error: "deadline-not-found" }, 404);

  await tenantDb.update(
    schema.deadlines,
    { sameDayReminderRequestedAt: null },
    eq(schema.deadlines.id, id),
  );
  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "deadline.remind-tonight.undone",
    target: id,
  });
  return c.body(null, 204);
});
