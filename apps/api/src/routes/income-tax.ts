import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { aggregateIncomeTaxYear } from "../lib/income-tax-aggregate";

export const incomeTax = new Hono<AppEnv>();

/**
 * Aggregates revenue/costs/hours live from every quarter's lines for the
 * year (not just filed ones — "so far" is honest about a partial year),
 * then runs the exact same engine functions the golden tests pin
 * (computeWaterfall, estimateIncomeTax). A year without a seeded
 * TaxFigures row degrades to `figuresPending: true` with every
 * figures-dependent field null — calendar data (revenue/costs/hours)
 * stays populated regardless, per the plan's degraded-mode non-negotiable.
 */
incomeTax.get("/:year", async (c) => {
  const tenantDb = c.get("tenantDb");
  const year = Number(c.req.param("year"));
  if (!Number.isInteger(year)) return c.json({ error: "invalid-year" }, 400);

  try {
    const response = await aggregateIncomeTaxYear(tenantDb, year);
    return c.json(response);
  } catch (err) {
    if (err instanceof Error && err.message === "business-profile-not-found") {
      return c.json({ error: "business-profile-not-found" }, 404);
    }
    throw err;
  }
});
