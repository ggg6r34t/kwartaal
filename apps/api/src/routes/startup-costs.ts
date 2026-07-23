import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { buildDepreciationSchedule, type StartupCost } from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { expenseLineDto } from "../lib/dto";

export const startupCosts = new Hono<AppEnv>();

/**
 * Cross-quarter by design — "spent before registering" money doesn't belong
 * to any one quarter's checklist, it belongs to the Vault's life-of-business
 * view. Depreciated lines get their full schedule recomputed live from the
 * same buildDepreciationSchedule the golden tests pin, not re-read from a
 * stored breakdown (the DepreciationSchedule row only stores the inputs).
 */
startupCosts.get("/", async (c) => {
  const tenantDb = c.get("tenantDb");
  const lines = (await tenantDb.select(schema.expenseLines)).filter(
    (l) => l.isStartupCost,
  );

  const result: StartupCost[] = [];
  for (const line of lines) {
    if (line.deductionMode !== "depreciate") {
      result.push({ line: expenseLineDto(line), depreciation: null });
      continue;
    }
    const [schedule] = await tenantDb.select(
      schema.depreciationSchedules,
      eq(schema.depreciationSchedules.expenseLineId, line.id),
    );
    if (!schedule) {
      result.push({ line: expenseLineDto(line), depreciation: null });
      continue;
    }
    const entries = buildDepreciationSchedule(
      line.amountExVatCents,
      schedule.years,
      schedule.residualCents,
      schedule.startMonth,
    );
    result.push({
      line: expenseLineDto(line),
      depreciation: {
        years: schedule.years,
        residualCents: schedule.residualCents,
        startMonth: schedule.startMonth,
        schedule: entries,
      },
    });
  }

  return c.json(result);
});
