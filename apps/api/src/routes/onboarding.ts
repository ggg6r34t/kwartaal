import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import {
  amsterdamDateString,
  deadlinesForYear,
  meResponseSchema,
  newId,
  onboardingCompleteRequestSchema,
  quarterPeriodEnd,
  type MeResponse,
} from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { toBusinessProfileDto } from "../lib/business-profile";
import { audit } from "../lib/audit";
import { computeEntitlement } from "../lib/entitlement";

export const onboarding = new Hono<AppEnv>();

/**
 * Materializes the org's tax year on first completion: quarters (skipped
 * entirely for KOR orgs — no btw filing cycle exists) and their deadlines,
 * with past-period quarters defaulting to `handled_elsewhere` (the
 * mid-year-signup case — a new user must never land on Today showing
 * overdue quarters they never owed us). Re-running onboarding later
 * ("change something") only updates preferences; materialization is a
 * one-time bootstrap gated on `onboardedAt` being null, since by the time
 * someone revisits onboarding real quarter data may already exist.
 */
onboarding.post(
  "/complete",
  zValidator("json", onboardingCompleteRequestSchema),
  async (c) => {
    const body = c.req.valid("json");
    const tenantDb = c.get("tenantDb");
    const session = c.get("session");
    const now = new Date();
    const todayIso = amsterdamDateString(now);
    const year = Number(todayIso.slice(0, 4));

    // TaxFigures for the year is org-invisible global reference data; a
    // missing row (year not seeded yet) must never block onboarding — the
    // KOR limit falls back to the last known figure (€20.000) rather than
    // failing the request.
    const [figuresRow] = await tenantDb.global
      .select()
      .from(schema.taxFigures)
      .where(eq(schema.taxFigures.year, year));
    const korLimitCents = figuresRow?.korLimitCents ?? 2_000_000;

    if (body.korOptIn && body.turnoverEstimateCents > korLimitCents) {
      return c.json({ error: "kor-not-eligible" }, 422);
    }

    const [existingProfile] = await tenantDb.select(schema.businessProfiles);
    if (!existingProfile) return c.json({ error: "business-profile-not-found" }, 404);
    const alreadyOnboarded = existingProfile.onboardedAt !== null;

    await tenantDb.update(schema.businessProfiles, {
      legalForm: body.legalForm,
      kvkRegisteredAt: body.kvkRegisteredAt,
      korOptIn: body.korOptIn,
      korSince: body.korOptIn ? todayIso : null,
      defaultSetAsideRateBps: body.defaultSetAsideRateBps,
      reminderCadence: body.reminderCadence,
      onboardedAt: now,
    });

    if (!alreadyOnboarded) {
      if (!body.korOptIn) {
        for (const quarter of [1, 2, 3, 4] as const) {
          const periodEnd = quarterPeriodEnd(year, quarter);
          const status = periodEnd < todayIso ? "handled_elsewhere" : "open";
          await tenantDb.insert(schema.quarters, {
            id: newId("quarter"),
            year,
            q: quarter,
            status,
          });
        }
      }

      const quarterRows = body.korOptIn
        ? []
        : await tenantDb.select(schema.quarters, eq(schema.quarters.year, year));

      for (const def of deadlinesForYear({ korOptIn: body.korOptIn }, year)) {
        const quarterId = def.quarter
          ? quarterRows.find((q) => q.q === def.quarter)?.id
          : undefined;
        await tenantDb.insert(schema.deadlines, {
          id: newId("deadline"),
          kind: def.kind,
          dueDate: def.dueDate,
          quarterId: quarterId ?? null,
        });
      }

      // Best-effort — a year without seeded TaxFigures degrades gracefully
      // by simply not getting a TaxYearProfile yet (fixes itself once the
      // figures are published; calendar/btw flows never depended on this).
      if (figuresRow) {
        const existingTyp = await tenantDb.select(
          schema.taxYearProfiles,
          eq(schema.taxYearProfiles.year, year),
        );
        if (existingTyp.length === 0) {
          await tenantDb.insert(schema.taxYearProfiles, {
            id: newId("taxYearProfile"),
            year,
            taxFiguresYear: year,
            hoursTarget: 1225,
          });
        }
      }
    }

    await audit(tenantDb, {
      actor: session.userId,
      action: "onboarding.completed",
      meta: { legalForm: body.legalForm, korOptIn: body.korOptIn, year },
    });

    const [org] = await tenantDb.global
      .select()
      .from(schema.orgs)
      .where(eq(schema.orgs.id, session.orgId));
    const [updatedProfile] = await tenantDb.select(schema.businessProfiles);
    const hasProAccess = await computeEntitlement(tenantDb);

    const response: MeResponse = {
      org: { id: org!.id, name: org!.name, createdAt: org!.createdAt.getTime() },
      role: session.role,
      businessProfile: toBusinessProfileDto(updatedProfile!),
      hasProAccess,
      deletionRequestedAt: org!.deletionRequestedAt
        ? org!.deletionRequestedAt.getTime()
        : null,
    };

    return c.json(meResponseSchema.parse(response));
  },
);
