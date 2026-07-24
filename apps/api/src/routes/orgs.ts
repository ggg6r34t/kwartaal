import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import {
  meResponseSchema,
  newId,
  toggleExplainModeSchema,
  type MeResponse,
} from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { toBusinessProfileDto } from "../lib/business-profile";
import { computeEntitlement } from "../lib/entitlement";
import { audit } from "../lib/audit";

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
  const [membership] = await tenantDb.select(
    schema.users,
    eq(schema.users.id, session.userId),
  );
  const hasProAccess = await computeEntitlement(tenantDb);

  const response: MeResponse = {
    org: { id: org.id, name: org.name, createdAt: org.createdAt.getTime() },
    role: session.role,
    businessProfile: row ? toBusinessProfileDto(row) : null,
    hasProAccess,
    deletionRequestedAt: org.deletionRequestedAt
      ? org.deletionRequestedAt.getTime()
      : null,
    explainModeEnabled: membership?.explainModeEnabled ?? true,
  };

  return c.json(meResponseSchema.parse(response));
});

/**
 * Any role (owner or bookkeeper) toggles their own reading preference —
 * this is not an org-level setting, so `requireRole` is deliberately not
 * applied here.
 */
orgs.patch("/me/explain-mode", zValidator("json", toggleExplainModeSchema), async (c) => {
  const session = c.get("session");
  const tenantDb = c.get("tenantDb");
  const body = c.req.valid("json");

  await tenantDb.update(
    schema.users,
    { explainModeEnabled: body.enabled },
    eq(schema.users.id, session.userId),
  );

  return c.json({ explainModeEnabled: body.enabled });
});

/**
 * The immediate half of "hard cascade delete with a 30-day grace export
 * prompt": sets deletionRequestedAt and enqueues the user's own full data
 * export right now, so the required export exists from day one of the
 * grace period rather than being generated at the last minute. The actual
 * 30-days-later hard delete is a weekly-cron sweep — same cron surface as
 * the Pillar 6 backup dump, implemented there (see PROGRESS.md); this
 * route does not delete anything by itself.
 */
orgs.post("/deletion-request", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const now = new Date();

  await tenantDb.global
    .update(schema.orgs)
    .set({ deletionRequestedAt: now, updatedAt: now })
    .where(eq(schema.orgs.id, tenantDb.orgId));

  const exportJobId = newId("exportJob");
  await tenantDb.insert(schema.exportJobs, {
    id: exportJobId,
    kind: "data",
    status: "queued",
    requestedBy: c.get("session").userId,
  });
  await c.env.EXPORT_QUEUE.send({ kind: "export", orgId: tenantDb.orgId, exportJobId });

  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "org.deletion-requested",
    target: exportJobId,
  });

  return c.json({ deletionRequestedAt: now.getTime(), exportJobId }, 201);
});

orgs.post("/deletion-cancel", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  await tenantDb.global
    .update(schema.orgs)
    .set({ deletionRequestedAt: null, updatedAt: new Date() })
    .where(eq(schema.orgs.id, tenantDb.orgId));

  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "org.deletion-cancelled",
  });

  return c.json({ deletionRequestedAt: null });
});
