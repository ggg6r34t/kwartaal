import { schema } from "@kwartaal/db/schema";
import type { TenantDb } from "@kwartaal/db";
import { newId } from "@kwartaal/core";

export interface AuditParams {
  actor: string;
  action: string; // dotted verb, e.g. "quarter.filed", "export.created"
  target?: string;
  ip?: string;
  meta?: Record<string, unknown>;
}

/** Appends an immutable audit row, populating ip and meta (fixes blueprint's unpopulated columns). */
export async function audit(tenantDb: TenantDb, params: AuditParams): Promise<void> {
  await tenantDb.insert(schema.auditLogs, {
    id: newId("auditLog"),
    actor: params.actor,
    action: params.action,
    target: params.target ?? null,
    ip: params.ip ?? null,
    meta: params.meta ?? null,
  });
}
