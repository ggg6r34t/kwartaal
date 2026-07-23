import { and, eq, type InferSelectModel, type SQL } from "drizzle-orm";
import type { Database } from "./client";
import { schema } from "./schema";

/**
 * The exhaustive registry of tenant tables (every table with a NOT NULL
 * org_id column, cascade-deleted from orgs). A test (tenant.test.ts) asserts
 * this stays in sync with schema.ts, so a new tenant table can't be added
 * without registering it here.
 *
 * Deliberately excluded (org-invisible or the tenant root itself, reached
 * only via `.global`): orgs (the tenant root has no org_id column),
 * rateLimits (keyed by IP, not org), taxFigures, glossaryTerms (global
 * reference data), and Better Auth's user/session/account/verification.
 */
const TENANT_TABLES = {
  users: schema.users,
  businessProfiles: schema.businessProfiles,
  taxYearProfiles: schema.taxYearProfiles,
  quarters: schema.quarters,
  incomeLines: schema.incomeLines,
  expenseLines: schema.expenseLines,
  depreciationSchedules: schema.depreciationSchedules,
  receipts: schema.receipts,
  hoursEntries: schema.hoursEntries,
  kmEntries: schema.kmEntries,
  pots: schema.pots,
  setAsideEntries: schema.setAsideEntries,
  voorlopigeAanslagen: schema.voorlopigeAanslagen,
  deadlines: schema.deadlines,
  reminderLogs: schema.reminderLogs,
  subscriptions: schema.subscriptions,
  exportJobs: schema.exportJobs,
  auditLogs: schema.auditLogs,
  secrets: schema.secrets,
  notifications: schema.notifications,
} as const;

export const TENANT_TABLE_NAMES = Object.keys(
  TENANT_TABLES,
) as (keyof typeof TENANT_TABLES)[];

export type TenantTable = (typeof TENANT_TABLES)[keyof typeof TENANT_TABLES];

const TENANT_TABLE_VALUES = new Set<unknown>(Object.values(TENANT_TABLES));

function assertTenantTable(table: unknown): asserts table is TenantTable {
  if (!TENANT_TABLE_VALUES.has(table)) {
    throw new Error(
      "tenant guard: table is not registered as a tenant table (no org_id column, or missing from TENANT_TABLE_NAMES)",
    );
  }
}

/**
 * A Database wrapper bound to one orgId. Injects org_id into every read and
 * forces org_id on every write, overriding whatever the caller passed. This
 * MUST be the only path route handlers use to touch tenant tables —
 * `requireSession` hands a TenantDb to handlers; the raw Database is never
 * exported to route code. `.global` is the sole, greppable escape hatch
 * (health checks, the Better Auth adapter, cron fan-out across orgs,
 * TaxFigures/GlossaryTerm reads).
 */
export class TenantDb {
  constructor(
    private readonly db: Database,
    readonly orgId: string,
  ) {}

  select<T extends TenantTable>(table: T, where?: SQL): Promise<InferSelectModel<T>[]> {
    assertTenantTable(table);
    const scope = eq(table.orgId, this.orgId);
    // Drizzle's builder chain doesn't distribute row types across a union-
    // typed table generic cleanly; InferSelectModel<T> gives callers the
    // correct concrete row shape for whichever table they actually passed.
    return this.db
      .select()
      .from(table)
      .where(where ? and(scope, where) : scope) as unknown as Promise<
      InferSelectModel<T>[]
    >;
  }

  insert<T extends TenantTable>(table: T, values: Record<string, unknown>) {
    assertTenantTable(table);
    return this.db.insert(table).values({
      ...values,
      orgId: this.orgId,
    } as never);
  }

  update<T extends TenantTable>(table: T, values: Record<string, unknown>, where?: SQL) {
    assertTenantTable(table);
    const scope = eq(table.orgId, this.orgId);
    return this.db
      .update(table)
      .set(values as never)
      .where(where ? and(scope, where) : scope);
  }

  delete<T extends TenantTable>(table: T, where?: SQL) {
    assertTenantTable(table);
    const scope = eq(table.orgId, this.orgId);
    return this.db.delete(table).where(where ? and(scope, where) : scope);
  }

  /** Explicit, greppable escape hatch to the unscoped client. */
  get global(): Database {
    return this.db;
  }
}

export function forOrg(db: Database, orgId: string): TenantDb {
  return new TenantDb(db, orgId);
}
