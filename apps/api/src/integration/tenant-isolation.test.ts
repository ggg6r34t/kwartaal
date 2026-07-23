import { describe, expect, it } from "vitest";
import { authedRequest, signUpAndOnboard } from "./helpers";

/**
 * Definition of Done: "Tenant isolation proven by a test running real
 * requests as two orgs asserting zero crossover." Two genuinely separate
 * orgs (real sign-ups, not seeded rows) each create data, then every
 * combination of "can org B see/read/mutate org A's stuff" is asserted
 * false — through the real HTTP surface, not by inspecting TenantDb
 * directly (which would only prove the guard exists, not that every route
 * actually uses it).
 */
describe("tenant isolation", () => {
  it("org B never sees org A's pots, hours, or quarters in list endpoints", async () => {
    const orgA = await signUpAndOnboard("tenant-a@example.com");
    const orgB = await signUpAndOnboard("tenant-b@example.com");
    expect(orgA.orgId).not.toBe(orgB.orgId);

    const potRes = await authedRequest(orgA.cookie, "/money/pots", {
      method: "POST",
      body: JSON.stringify({
        name: "Org A Taxes",
        targetCents: 100000,
        kind: "business",
      }),
    });
    expect(potRes.status).toBe(201);
    const pot = (await potRes.json()) as { id: string };

    const hoursRes = await authedRequest(orgA.cookie, "/hours-entries", {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-01", hours: 5, note: "org A work" }),
    });
    expect(hoursRes.status).toBe(201);

    // org B's own lists must never contain org A's rows.
    const potsAsB = await authedRequest(orgB.cookie, "/money/pots");
    const potsAsBBody = (await potsAsB.json()) as { id: string }[];
    expect(potsAsBBody.find((p) => p.id === pot.id)).toBeUndefined();

    const hoursAsB = await authedRequest(orgB.cookie, "/hours-entries");
    const hoursAsBBody = (await hoursAsB.json()) as unknown[];
    expect(hoursAsBBody).toHaveLength(0);

    // org B directly addressing org A's pot id by URL must not succeed.
    const crossMutateAttempt = await authedRequest(orgB.cookie, `/money/pots/${pot.id}`, {
      method: "PATCH",
      body: JSON.stringify({ currentCents: 999999 }),
    });
    // TenantDb's update() always scopes by the session's own org_id, so
    // this either 404s or silently affects zero rows — never org A's row.
    if (crossMutateAttempt.status === 200) {
      const updated = (await crossMutateAttempt.json()) as { id?: string };
      expect(updated.id).not.toBe(pot.id);
    } else {
      expect(crossMutateAttempt.status).toBe(404);
    }

    // The row itself must be provably unchanged when read back as org A.
    const potsAsAAfter = await authedRequest(orgA.cookie, "/money/pots");
    const potsAsAAfterBody = (await potsAsAAfter.json()) as {
      id: string;
      currentCents: number;
    }[];
    const potAfter = potsAsAAfterBody.find((p) => p.id === pot.id);
    expect(potAfter?.currentCents).toBe(0);
  });

  it("org B cannot read org A's quarters or their income/expense lines", async () => {
    const orgA = await signUpAndOnboard("tenant-quarters-a@example.com");
    const orgB = await signUpAndOnboard("tenant-quarters-b@example.com");

    const quartersAsA = await authedRequest(orgA.cookie, "/quarters?year=2026");
    const quartersAsABody = (await quartersAsA.json()) as { id: string }[];
    expect(quartersAsABody.length).toBeGreaterThan(0);
    const orgAQuarterId = quartersAsABody[0]!.id;

    const quartersAsB = await authedRequest(orgB.cookie, "/quarters?year=2026");
    const quartersAsBBody = (await quartersAsB.json()) as { id: string }[];
    expect(quartersAsBBody.find((q) => q.id === orgAQuarterId)).toBeUndefined();

    // org B addressing org A's quarter id directly by URL.
    const crossDetail = await authedRequest(orgB.cookie, `/quarters/${orgAQuarterId}`);
    expect(crossDetail.status).toBe(404);

    // org B attempting to add an expense line onto org A's quarter.
    const crossWrite = await authedRequest(
      orgB.cookie,
      `/quarters/${orgAQuarterId}/expense-lines`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-07-01",
          supplier: "Attacker Supplier",
          amountExVatCents: 1000,
          vatRate: 21,
          vatReclaimable: true,
          isStartupCost: false,
          deductionMode: "expense",
        }),
      },
    );
    expect(crossWrite.status).toBe(404);
  });
});
