import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import {
  confirmSetAsideEntrySchema,
  createPotSchema,
  createSetAsideEntrySchema,
  deadlinesForYear,
  newId,
  splitInvoice,
  updatePotSchema,
  voorlopigeAanslagSchema,
  type VoorlopigeAanslag,
} from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";
import { potDto, setAsideEntryDto, voorlopigeAanslagDto } from "../lib/dto-vault";

export const money = new Hono<AppEnv>();

// ─── Pots ────────────────────────────────────────────────────────────────

money.get("/pots", async (c) => {
  const tenantDb = c.get("tenantDb");
  const rows = await tenantDb.select(schema.pots);
  return c.json(rows.map(potDto));
});

money.post(
  "/pots",
  requireRole("owner"),
  zValidator("json", createPotSchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const body = c.req.valid("json");
    const id = newId("pot");
    await tenantDb.insert(schema.pots, {
      id,
      name: body.name,
      targetCents: body.targetCents,
      kind: body.kind,
    });
    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "pot.created",
      target: id,
    });
    const [row] = await tenantDb.select(schema.pots, eq(schema.pots.id, id));
    return c.json(potDto(row!), 201);
  },
);

/** The "manual monthly review ritual" — no bank connection, the user types what's actually in each pot. */
money.patch(
  "/pots/:id",
  requireRole("owner"),
  zValidator("json", updatePotSchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const id = c.req.param("id");
    const body = c.req.valid("json");
    await tenantDb.update(
      schema.pots,
      { currentCents: body.currentCents },
      eq(schema.pots.id, id),
    );
    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "pot.reviewed",
      target: id,
      meta: { currentCents: body.currentCents },
    });
    const [row] = await tenantDb.select(schema.pots, eq(schema.pots.id, id));
    if (!row) return c.json({ error: "pot-not-found" }, 404);
    return c.json(potDto(row));
  },
);

// ─── Set-aside entries (per-invoice toast) ──────────────────────────────

money.get("/set-aside-entries", async (c) => {
  const tenantDb = c.get("tenantDb");
  const rows = await tenantDb.select(schema.setAsideEntries);
  return c.json(rows.map(setAsideEntryDto));
});

money.post(
  "/set-aside-entries",
  requireRole("owner"),
  zValidator("json", createSetAsideEntrySchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const body = c.req.valid("json");
    const split = splitInvoice(body.totalCents, body.vatRate, body.reserveRateBps);
    const id = newId("setAsideEntry");
    await tenantDb.insert(schema.setAsideEntries, {
      id,
      invoiceRef: body.invoiceRef,
      totalCents: body.totalCents,
      vatCents: split.vatCents,
      reserveCents: split.reserveCents,
      rateBps: body.reserveRateBps,
      status: body.status,
    });
    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "set-aside-entry.created",
      target: id,
      meta: { status: body.status },
    });
    const [row] = await tenantDb.select(
      schema.setAsideEntries,
      eq(schema.setAsideEntries.id, id),
    );
    return c.json(setAsideEntryDto(row!), 201);
  },
);

/** "I moved it — done" resolving a pinned split: flips a pending entry to confirmed. */
money.patch(
  "/set-aside-entries/:id",
  requireRole("owner"),
  zValidator("json", confirmSetAsideEntrySchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const [existing] = await tenantDb.select(
      schema.setAsideEntries,
      eq(schema.setAsideEntries.id, id),
    );
    if (!existing) return c.json({ error: "set-aside-entry-not-found" }, 404);

    await tenantDb.update(
      schema.setAsideEntries,
      { status: body.status },
      eq(schema.setAsideEntries.id, id),
    );
    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "set-aside-entry.confirmed",
      target: id,
    });

    const [row] = await tenantDb.select(
      schema.setAsideEntries,
      eq(schema.setAsideEntries.id, id),
    );
    return c.json(setAsideEntryDto(row!));
  },
);

// ─── Voorlopige aanslag ──────────────────────────────────────────────────

money.get("/voorlopige-aanslag/:year", async (c) => {
  const tenantDb = c.get("tenantDb");
  const year = Number(c.req.param("year"));
  const [row] = await tenantDb.select(
    schema.voorlopigeAanslagen,
    eq(schema.voorlopigeAanslagen.year, year),
  );
  return c.json(row ? voorlopigeAanslagDto(row) : null);
});

/**
 * Upserts the year's single voorlopige aanslag row and rematerializes its
 * monthly Deadline rows (delete-then-insert — there's no natural unique
 * key across a rate change to upsert against, and this table has no
 * ReminderLog history riding on specific deadline ids the way quarters do).
 */
money.put(
  "/voorlopige-aanslag",
  requireRole("owner"),
  zValidator("json", voorlopigeAanslagSchema.omit({ id: true, orgId: true })),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const body = c.req.valid("json") as Omit<VoorlopigeAanslag, "id" | "orgId">;

    const [existing] = await tenantDb.select(
      schema.voorlopigeAanslagen,
      eq(schema.voorlopigeAanslagen.year, body.year),
    );

    if (existing) {
      await tenantDb.update(
        schema.voorlopigeAanslagen,
        {
          monthlyCents: body.monthlyCents,
          startMonth: body.startMonth,
          active: body.active,
        },
        eq(schema.voorlopigeAanslagen.id, existing.id),
      );
    } else {
      await tenantDb.insert(schema.voorlopigeAanslagen, {
        id: newId("voorlopigeAanslag"),
        year: body.year,
        monthlyCents: body.monthlyCents,
        startMonth: body.startMonth,
        active: body.active,
      });
    }

    // Rematerialize this year's VA deadlines only — btw_q/income_tax rows
    // (created once at onboarding) are untouched.
    const staleVaDeadlines = await tenantDb.select(
      schema.deadlines,
      and(eq(schema.deadlines.kind, "voorlopige_aanslag")),
    );
    for (const d of staleVaDeadlines.filter((d) =>
      d.dueDate.startsWith(`${body.year}-`),
    )) {
      await tenantDb.delete(schema.deadlines, eq(schema.deadlines.id, d.id));
    }

    if (body.active) {
      const defs = deadlinesForYear(
        {
          korOptIn: false,
          voorlopigeAanslag: { active: true, startMonth: body.startMonth },
        },
        body.year,
      );
      for (const def of defs.filter((d) => d.kind === "voorlopige_aanslag")) {
        await tenantDb.insert(schema.deadlines, {
          id: newId("deadline"),
          kind: def.kind,
          dueDate: def.dueDate,
          quarterId: null,
        });
      }
    }

    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "voorlopige-aanslag.updated",
      meta: { year: body.year, active: body.active },
    });

    const [row] = await tenantDb.select(
      schema.voorlopigeAanslagen,
      eq(schema.voorlopigeAanslagen.year, body.year),
    );
    return c.json(voorlopigeAanslagDto(row!));
  },
);
