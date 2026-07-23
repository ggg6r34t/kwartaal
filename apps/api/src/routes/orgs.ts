import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { meResponseSchema, type BusinessProfile, type MeResponse } from "@kwartaal/core";
import type { AppEnv } from "../bindings";

export const orgs = new Hono<AppEnv>();

orgs.get("/me", async (c) => {
  const session = c.get("session");
  const tenantDb = c.get("tenantDb");

  // Org is the tenant root (no org_id column) — reading it is a structurally
  // necessary `.global` use, not a tenant-table read.
  const [org] = await tenantDb.global
    .select()
    .from(schema.orgs)
    .where(eq(schema.orgs.id, session.orgId));
  if (!org) return c.json({ error: "org-not-found" }, 404);

  const [row] = await tenantDb.select(schema.businessProfiles);

  const businessProfile: BusinessProfile | null = row
    ? {
        id: row.id,
        orgId: row.orgId,
        legalForm: row.legalForm as BusinessProfile["legalForm"],
        kvkRegisteredAt: row.kvkRegisteredAt,
        korOptIn: row.korOptIn,
        korSince: row.korSince,
        hasSalariedJob: row.hasSalariedJob,
        startersaftrekUsedCount: row.startersaftrekUsedCount,
        defaultSetAsideRateBps: row.defaultSetAsideRateBps,
        firstQuarterClosedAt: row.firstQuarterClosedAt
          ? row.firstQuarterClosedAt.getTime()
          : null,
      }
    : null;

  const response: MeResponse = {
    org: { id: org.id, name: org.name, createdAt: org.createdAt.getTime() },
    role: session.role,
    businessProfile,
  };

  return c.json(meResponseSchema.parse(response));
});
