import { Hono } from "hono";
import { schema } from "@kwartaal/db/schema";
import { glossaryTermSchema, type GlossaryTermRow } from "@kwartaal/core";
import type { AppEnv } from "../bindings";

export const glossary = new Hono<AppEnv>();

// GlossaryTerm is global, org-invisible reference data (no org_id column) —
// `.global` is the correct, sanctioned path, not a tenant-table read.
glossary.get("/", async (c) => {
  const tenantDb = c.get("tenantDb");
  const rows = await tenantDb.global.select().from(schema.glossaryTerms);
  const dtos: GlossaryTermRow[] = rows.map((row) => glossaryTermSchema.parse(row));
  return c.json(dtos);
});
