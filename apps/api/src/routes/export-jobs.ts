import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { createExportJobSchema, newId } from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";
import { exportJobDto } from "../lib/dto-vault";

export const exportJobs = new Hono<AppEnv>();

exportJobs.get("/", async (c) => {
  const tenantDb = c.get("tenantDb");
  const rows = await tenantDb.select(schema.exportJobs);
  const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return c.json(sorted.map(exportJobDto));
});

/**
 * Enqueues the zip/PDF build — never built inline in the request handler
 * (async rule, KWARTAAL-BUILD-PLAN "no email sends or export builds in a
 * request handler"). The consumer in queue.ts does the actual work and
 * flips status; kind="data" is the full 7-year-retention export, kind=
 * "bookkeeper_summary" is the per-quarter print-to-PDF handoff.
 */
exportJobs.post(
  "/",
  requireRole("owner"),
  zValidator("json", createExportJobSchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const body = c.req.valid("json");
    const id = newId("exportJob");
    await tenantDb.insert(schema.exportJobs, {
      id,
      kind: body.kind,
      year: body.kind === "bookkeeper_summary" ? body.year : null,
      status: "queued",
      requestedBy: c.get("session").userId,
    });
    await c.env.EXPORT_QUEUE.send({
      kind: "export",
      orgId: tenantDb.orgId,
      exportJobId: id,
    });
    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "export-job.requested",
      target: id,
    });
    const [row] = await tenantDb.select(schema.exportJobs, eq(schema.exportJobs.id, id));
    return c.json(exportJobDto(row!), 201);
  },
);

exportJobs.get("/:id/file", async (c) => {
  const tenantDb = c.get("tenantDb");
  const [row] = await tenantDb.select(
    schema.exportJobs,
    eq(schema.exportJobs.id, c.req.param("id")),
  );
  if (!row || row.status !== "completed" || !row.r2Key) {
    return c.json({ error: "export-not-ready" }, 404);
  }
  const object = await c.env.RECEIPTS.get(row.r2Key);
  if (!object) return c.json({ error: "file-not-found" }, 404);
  const isPdf = row.kind === "bookkeeper_summary";
  return new Response(object.body, {
    headers: {
      "content-type": isPdf ? "application/pdf" : "application/zip",
      "content-disposition": `attachment; filename="kwartaal-${row.kind}-${row.id}.${isPdf ? "pdf" : "zip"}"`,
    },
  });
});
