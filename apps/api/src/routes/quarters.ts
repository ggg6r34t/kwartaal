import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import {
  buildDepreciationSchedule,
  computeQuarter,
  createExpenseLineSchema,
  createIncomeLineSchema,
  detectImportAdapter,
  importCommitRequestSchema,
  importPreviewRequestSchema,
  newId,
  parseCsv,
  parseGenericExpenseCsv,
  parseGenericIncomeCsv,
  quarterDetailSchema,
  quarterSchema,
  vatCentsForRate,
  type PayQuarterResponse,
} from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";
import {
  apiVatRateToDb,
  dbVatRateToApi,
  expenseLineDto,
  incomeLineDto,
  quarterDto,
} from "../lib/dto";

export const quarters = new Hono<AppEnv>();

quarters.get("/", async (c) => {
  const tenantDb = c.get("tenantDb");
  const yearParam = c.req.query("year");
  const rows = yearParam
    ? await tenantDb.select(schema.quarters, eq(schema.quarters.year, Number(yearParam)))
    : await tenantDb.select(schema.quarters);
  return c.json(rows.map(quarterDto));
});

quarters.get("/:id", async (c) => {
  const tenantDb = c.get("tenantDb");
  const [quarter] = await tenantDb.select(
    schema.quarters,
    eq(schema.quarters.id, c.req.param("id")),
  );
  if (!quarter) return c.json({ error: "quarter-not-found" }, 404);

  const incomeLines = await tenantDb.select(
    schema.incomeLines,
    eq(schema.incomeLines.quarterId, quarter.id),
  );
  const expenseLines = await tenantDb.select(
    schema.expenseLines,
    eq(schema.expenseLines.quarterId, quarter.id),
  );

  return c.json(
    quarterDetailSchema.parse({
      ...quarterDto(quarter),
      incomeLines: incomeLines.map(incomeLineDto),
      expenseLines: expenseLines.map(expenseLineDto),
    }),
  );
});

quarters.post(
  "/:id/income-lines",
  requireRole("owner"),
  zValidator("json", createIncomeLineSchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const [quarter] = await tenantDb.select(
      schema.quarters,
      eq(schema.quarters.id, c.req.param("id")),
    );
    if (!quarter) return c.json({ error: "quarter-not-found" }, 404);
    if (quarter.status === "filed" || quarter.status === "paid") {
      return c.json({ error: "quarter-closed" }, 409);
    }

    const body = c.req.valid("json");
    const vatCents =
      body.vatRate === "exempt" || body.vatRate === 0
        ? 0
        : vatCentsForRate(body.amountExVatCents, body.vatRate);
    const id = newId("incomeLine");

    await tenantDb.insert(schema.incomeLines, {
      id,
      quarterId: quarter.id,
      date: body.date,
      description: body.description,
      amountExVatCents: body.amountExVatCents,
      vatRate: apiVatRateToDb(body.vatRate),
      vatCents,
      source: "manual",
      importSource: null,
    });

    if (quarter.status === "open") {
      await tenantDb.update(
        schema.quarters,
        { status: "in_progress" },
        eq(schema.quarters.id, quarter.id),
      );
    }

    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "income-line.created",
      target: id,
    });

    const [row] = await tenantDb.select(
      schema.incomeLines,
      eq(schema.incomeLines.id, id),
    );
    return c.json(incomeLineDto(row!), 201);
  },
);

quarters.post(
  "/:id/expense-lines",
  requireRole("owner"),
  zValidator("json", createExpenseLineSchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const [quarter] = await tenantDb.select(
      schema.quarters,
      eq(schema.quarters.id, c.req.param("id")),
    );
    if (!quarter) return c.json({ error: "quarter-not-found" }, 404);
    if (quarter.status === "filed" || quarter.status === "paid") {
      return c.json({ error: "quarter-closed" }, 409);
    }

    const body = c.req.valid("json");
    const vatCents =
      body.vatRate === "exempt" || body.vatRate === 0
        ? 0
        : vatCentsForRate(body.amountExVatCents, body.vatRate);
    const id = newId("expenseLine");

    await tenantDb.insert(schema.expenseLines, {
      id,
      quarterId: quarter.id,
      date: body.date,
      supplier: body.supplier,
      amountExVatCents: body.amountExVatCents,
      vatRate: apiVatRateToDb(body.vatRate),
      vatCents,
      vatReclaimable: body.vatReclaimable,
      isStartupCost: body.isStartupCost,
      deductionMode: body.deductionMode,
      receiptId: null,
    });

    if (body.deductionMode === "depreciate" && body.depreciation) {
      const schedule = buildDepreciationSchedule(
        body.amountExVatCents,
        body.depreciation.years,
        body.depreciation.residualCents,
        body.depreciation.startMonth,
      );
      const annualCents = schedule[1]?.amountCents ?? schedule[0]?.amountCents ?? 0;
      await tenantDb.insert(schema.depreciationSchedules, {
        id: newId("depreciationSchedule"),
        expenseLineId: id,
        years: body.depreciation.years,
        residualCents: body.depreciation.residualCents,
        annualCents,
        startMonth: body.depreciation.startMonth,
      });
    }

    if (quarter.status === "open") {
      await tenantDb.update(
        schema.quarters,
        { status: "in_progress" },
        eq(schema.quarters.id, quarter.id),
      );
    }

    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "expense-line.created",
      target: id,
    });

    const [row] = await tenantDb.select(
      schema.expenseLines,
      eq(schema.expenseLines.id, id),
    );
    return c.json(expenseLineDto(row!), 201);
  },
);

quarters.post(
  "/:id/import/preview",
  requireRole("owner"),
  zValidator("json", importPreviewRequestSchema),
  async (c) => {
    const body = c.req.valid("json");
    const rows = parseCsv(body.csvText);
    const headerRow = body.hasHeaderRow ? rows[0] : undefined;
    const dataRows = body.hasHeaderRow ? rows.slice(1) : rows;

    // Named-adapter auto-detection happens here too: a recognized header
    // means the manual mapping the caller supplied is redundant, but since
    // no adapter can currently detect anything (see adapters.ts), this is
    // a no-op today and simply falls through to the generic path.
    if (headerRow) detectImportAdapter(headerRow);

    const result =
      body.lineType === "income"
        ? parseGenericIncomeCsv(dataRows, body.mapping)
        : parseGenericExpenseCsv(dataRows, body.mapping);

    return c.json({ lines: result.lines, errors: result.errors });
  },
);

quarters.post(
  "/:id/import/commit",
  requireRole("owner"),
  zValidator("json", importCommitRequestSchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const [quarter] = await tenantDb.select(
      schema.quarters,
      eq(schema.quarters.id, c.req.param("id")),
    );
    if (!quarter) return c.json({ error: "quarter-not-found" }, 404);
    if (quarter.status === "filed" || quarter.status === "paid") {
      return c.json({ error: "quarter-closed" }, 409);
    }

    const body = c.req.valid("json");
    const insertedIds: string[] = [];

    if (body.lineType === "income") {
      for (const line of body.lines as {
        date: string;
        description: string;
        amountExVatCents: number;
        vatRate: 21 | 9 | 0 | "exempt";
      }[]) {
        const vatCents =
          line.vatRate === "exempt" || line.vatRate === 0
            ? 0
            : vatCentsForRate(line.amountExVatCents, line.vatRate);
        const id = newId("incomeLine");
        await tenantDb.insert(schema.incomeLines, {
          id,
          quarterId: quarter.id,
          date: line.date,
          description: line.description,
          amountExVatCents: line.amountExVatCents,
          vatRate: apiVatRateToDb(line.vatRate),
          vatCents,
          source: "import",
          importSource: "generic_csv",
        });
        insertedIds.push(id);
      }
    } else {
      for (const line of body.lines as {
        date: string;
        supplier: string;
        amountExVatCents: number;
        vatRate: 21 | 9 | 0 | "exempt";
        vatReclaimable: boolean;
      }[]) {
        const vatCents =
          line.vatRate === "exempt" || line.vatRate === 0
            ? 0
            : vatCentsForRate(line.amountExVatCents, line.vatRate);
        const id = newId("expenseLine");
        await tenantDb.insert(schema.expenseLines, {
          id,
          quarterId: quarter.id,
          date: line.date,
          supplier: line.supplier,
          amountExVatCents: line.amountExVatCents,
          vatRate: apiVatRateToDb(line.vatRate),
          vatCents,
          vatReclaimable: line.vatReclaimable,
          isStartupCost: false,
          deductionMode: "expense",
          receiptId: null,
        });
        insertedIds.push(id);
      }
    }

    if (quarter.status === "open") {
      await tenantDb.update(
        schema.quarters,
        { status: "in_progress" },
        eq(schema.quarters.id, quarter.id),
      );
    }

    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "quarter.import-committed",
      target: quarter.id,
      meta: { lineType: body.lineType, count: insertedIds.length },
    });

    return c.json({ committed: insertedIds.length }, 201);
  },
);

quarters.post("/:id/file", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const [quarter] = await tenantDb.select(
    schema.quarters,
    eq(schema.quarters.id, c.req.param("id")),
  );
  if (!quarter) return c.json({ error: "quarter-not-found" }, 404);
  if (quarter.status === "filed" || quarter.status === "paid") {
    return c.json({ error: "already-filed" }, 409);
  }
  if (quarter.status === "handled_elsewhere" || quarter.status === "open") {
    return c.json({ error: "nothing-to-file" }, 409);
  }

  const incomeLines = await tenantDb.select(
    schema.incomeLines,
    eq(schema.incomeLines.quarterId, quarter.id),
  );
  const expenseLines = await tenantDb.select(
    schema.expenseLines,
    eq(schema.expenseLines.quarterId, quarter.id),
  );

  const incomeInputs = incomeLines.map((l) => ({
    amountExVatCents: l.amountExVatCents,
    vatRate: dbVatRateToApi(l.vatRate),
  }));
  const expenseInputs = expenseLines.map((l) => ({
    amountExVatCents: l.amountExVatCents,
    vatRate: dbVatRateToApi(l.vatRate),
    vatReclaimable: l.vatReclaimable,
  }));
  const result = computeQuarter(incomeInputs, expenseInputs);

  const now = new Date();
  await tenantDb.update(
    schema.quarters,
    {
      status: "filed",
      filedAt: now,
      rubriek1aCents: result.rubriek1aCents,
      rubriek1bCents: result.rubriek1bCents,
      rubriek5bCents: result.rubriek5bCents,
      rubriek5cCents: result.rubriek5cCents,
    },
    eq(schema.quarters.id, quarter.id),
  );

  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "quarter.filed",
    target: quarter.id,
    meta: { ...result },
  });

  const [updated] = await tenantDb.select(
    schema.quarters,
    eq(schema.quarters.id, quarter.id),
  );
  return c.json(quarterSchema.parse(quarterDto(updated!)));
});

quarters.post("/:id/pay", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const [quarter] = await tenantDb.select(
    schema.quarters,
    eq(schema.quarters.id, c.req.param("id")),
  );
  if (!quarter) return c.json({ error: "quarter-not-found" }, 404);
  if (quarter.status === "paid") return c.json({ error: "already-paid" }, 409);
  if (quarter.status !== "filed") return c.json({ error: "file-before-paying" }, 409);

  const now = new Date();
  await tenantDb.update(
    schema.quarters,
    { status: "paid", paidAt: now },
    eq(schema.quarters.id, quarter.id),
  );

  // Trial-closing event (locked decision #5): set ONLY on the filed+paid
  // transition of a real quarter, set once, never cleared. handled_elsewhere
  // quarters never reach this handler at all, so they structurally can't
  // trigger it — no separate exclusion logic needed.
  const [profile] = await tenantDb.select(schema.businessProfiles);
  let firstQuarterJustClosed = false;
  if (profile && profile.firstQuarterClosedAt === null) {
    await tenantDb.update(schema.businessProfiles, { firstQuarterClosedAt: now });
    firstQuarterJustClosed = true;
  }

  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "quarter.paid",
    target: quarter.id,
    meta: { firstQuarterJustClosed },
  });

  const [updated] = await tenantDb.select(
    schema.quarters,
    eq(schema.quarters.id, quarter.id),
  );
  const response: PayQuarterResponse = {
    ...quarterDto(updated!),
    firstQuarterJustClosed,
  };
  return c.json(response);
});

quarters.post("/:id/reopen", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const [quarter] = await tenantDb.select(
    schema.quarters,
    eq(schema.quarters.id, c.req.param("id")),
  );
  if (!quarter) return c.json({ error: "quarter-not-found" }, 404);
  if (quarter.status === "open" || quarter.status === "in_progress") {
    return c.json({ error: "quarter-not-closed" }, 409);
  }

  // handled_elsewhere -> open (the "log it here instead" mid-year-signup
  // case); filed/paid -> in_progress (editing a closed quarter). Never
  // touches firstQuarterClosedAt — that flag is set once and never cleared.
  const newStatus = quarter.status === "handled_elsewhere" ? "open" : "in_progress";
  await tenantDb.update(
    schema.quarters,
    { status: newStatus },
    eq(schema.quarters.id, quarter.id),
  );

  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "quarter.reopened",
    target: quarter.id,
    meta: { from: quarter.status, to: newStatus },
  });

  const [updated] = await tenantDb.select(
    schema.quarters,
    eq(schema.quarters.id, quarter.id),
  );
  return c.json(quarterSchema.parse(quarterDto(updated!)));
});
