import { Hono } from "hono";
import { schema } from "@kwartaal/db/schema";
import type { DeadlineRow } from "@kwartaal/core";
import type { AppEnv } from "../bindings";

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
  }));

  return c.json(dtos);
});
