import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import {
  newId,
  RECEIPT_CHECKLIST_ELEMENTS,
  updateReceiptChecklistSchema,
} from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";
import { receiptDto } from "../lib/dto-vault";

export const receipts = new Hono<AppEnv>();

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
// Per-org daily cap (the architecture non-negotiable's "receipt upload: per-org
// daily cap + max file size 8 MB, content-type allow-list") — distinct from
// the IP-keyed rate-limit middleware, which can't express "per org".
const DAILY_UPLOAD_CAP = 50;

receipts.get("/", async (c) => {
  const tenantDb = c.get("tenantDb");
  const rows = await tenantDb.select(schema.receipts);
  const year = c.req.query("year");
  const missingOnly = c.req.query("missingOnly") === "true";

  let filtered = rows;
  if (year)
    filtered = filtered.filter((r) => r.capturedAt.toISOString().startsWith(`${year}-`));
  if (missingOnly) filtered = filtered.filter((r) => r.missingCount > 0);
  filtered = [...filtered].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );

  return c.json(filtered.map(receiptDto));
});

receipts.post("/", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const contentType = c.req.header("content-type") ?? "";
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) return c.json({ error: "unsupported-content-type" }, 415);

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) return c.json({ error: "empty-body" }, 422);
  if (body.byteLength > MAX_UPLOAD_BYTES) return c.json({ error: "file-too-large" }, 413);

  const todayIso = new Date().toISOString().slice(0, 10);
  const existing = await tenantDb.select(schema.receipts);
  const todayCount = existing.filter((r) =>
    r.capturedAt.toISOString().startsWith(todayIso),
  ).length;
  if (todayCount >= DAILY_UPLOAD_CAP)
    return c.json({ error: "daily-upload-cap-reached" }, 429);

  const id = newId("receipt");
  const r2Key = `${tenantDb.orgId}/receipts/${id}.${ext}`;
  await c.env.RECEIPTS.put(r2Key, body, { httpMetadata: { contentType } });

  const checklist = Object.fromEntries(
    RECEIPT_CHECKLIST_ELEMENTS.map((el) => [el, { confirmed: false }]),
  );
  await tenantDb.insert(schema.receipts, {
    id,
    r2Key,
    checklist,
    missingCount: RECEIPT_CHECKLIST_ELEMENTS.length,
  });

  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "receipt.uploaded",
    target: id,
  });

  const [row] = await tenantDb.select(schema.receipts, eq(schema.receipts.id, id));
  return c.json(receiptDto(row!), 201);
});

receipts.get("/:id/file", async (c) => {
  const tenantDb = c.get("tenantDb");
  const [row] = await tenantDb.select(
    schema.receipts,
    eq(schema.receipts.id, c.req.param("id")),
  );
  if (!row) return c.json({ error: "receipt-not-found" }, 404);
  const object = await c.env.RECEIPTS.get(row.r2Key);
  if (!object) return c.json({ error: "file-not-found" }, 404);
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    },
  });
});

receipts.patch(
  "/:id/checklist",
  requireRole("owner"),
  zValidator("json", updateReceiptChecklistSchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const [existingRow] = await tenantDb.select(
      schema.receipts,
      eq(schema.receipts.id, id),
    );
    if (!existingRow) return c.json({ error: "receipt-not-found" }, 404);

    const merged = { ...(existingRow.checklist ?? {}), ...body.checklist };
    const missingCount = RECEIPT_CHECKLIST_ELEMENTS.filter(
      (el) => !merged[el]?.confirmed,
    ).length;

    await tenantDb.update(
      schema.receipts,
      { checklist: merged, missingCount },
      eq(schema.receipts.id, id),
    );
    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "receipt.checklist-updated",
      target: id,
      meta: { missingCount },
    });

    const [row] = await tenantDb.select(schema.receipts, eq(schema.receipts.id, id));
    return c.json(receiptDto(row!));
  },
);
