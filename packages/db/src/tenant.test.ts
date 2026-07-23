import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { schema } from "./schema";
import { TenantDb, TENANT_TABLE_NAMES } from "./tenant";

/** Tables deliberately outside TenantDb: the tenant root itself, plus global/org-invisible reference data. */
const EXPECTED_NON_TENANT = new Set([
  "orgs",
  "rateLimits",
  "taxFigures",
  "glossaryTerms",
]);

describe("tenant table registry", () => {
  it("includes every schema table with an org_id column, and only those", () => {
    const actualTenantTables = Object.entries(schema)
      .filter(([name]) => !EXPECTED_NON_TENANT.has(name))
      .filter(([, table]) => "orgId" in getTableColumns(table))
      .map(([name]) => name)
      .sort();

    expect([...TENANT_TABLE_NAMES].sort()).toEqual(actualTenantTables);
  });

  it("every declared non-tenant table (other than the tenant root) genuinely lacks org_id", () => {
    for (const name of EXPECTED_NON_TENANT) {
      if (name === "orgs") continue; // the tenant root, not a tenant-scoped table
      const table = schema[name as keyof typeof schema];
      expect("orgId" in getTableColumns(table)).toBe(false);
    }
  });
});

describe("TenantDb guard", () => {
  it("throws when asked to touch a table that isn't in the tenant registry", () => {
    const fakeDb = {} as never;
    const tenantDb = new TenantDb(fakeDb, "org_test");
    expect(() => tenantDb.select(schema.taxFigures as never)).toThrow(/tenant guard/);
  });

  it("throws for the orgs table itself (the tenant root, not a tenant table)", () => {
    const fakeDb = {} as never;
    const tenantDb = new TenantDb(fakeDb, "org_test");
    expect(() => tenantDb.select(schema.orgs as never)).toThrow(/tenant guard/);
  });
});
