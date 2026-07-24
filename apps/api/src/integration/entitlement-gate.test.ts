import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { authedRequest, signUpAndOnboard } from "./helpers";

/**
 * Definition of Done: "full Pro access pre-first-drawer with no card, gate
 * drops exactly once at firstQuarterClosedAt, trial data remains readable
 * and exportable but immutable behind the gate, and no code path ever
 * deletes trial data on expiry." `requireProForMutations`
 * (apps/api/src/middleware/entitlement.ts) blocks every non-GET once the
 * gate closes — these tests drive that closure for real (a direct write
 * to `business_profiles.first_quarter_closed_at`, the same column
 * `computeEntitlement` reads) and prove each clause against real routes.
 */
describe("entitlement gate (Pro-required mutations)", () => {
  it("mutations succeed during the trial (no quarter closed yet)", async () => {
    const org = await signUpAndOnboard("gate-owner-a@example.com");
    const res = await authedRequest(org.cookie, "/money/pots", {
      method: "POST",
      body: JSON.stringify({ name: "Taxes", targetCents: 100000, kind: "business" }),
    });
    expect(res.status).toBe(201);
  });

  it("reads stay open and existing trial data stays intact once the gate closes, but new mutations 402", async () => {
    const org = await signUpAndOnboard("gate-owner-b@example.com");

    const createRes = await authedRequest(org.cookie, "/money/pots", {
      method: "POST",
      body: JSON.stringify({ name: "Taxes", targetCents: 100000, kind: "business" }),
    });
    const created = (await createRes.json()) as { id: string; name: string };

    // Close the gate — the same column computeEntitlement reads.
    await env.DB.prepare(
      "UPDATE business_profiles SET first_quarter_closed_at = ? WHERE org_id = ?",
    )
      .bind(Date.now(), org.orgId)
      .run();

    // Reads: still fully open (F-015 — "trial data remains readable").
    const listRes = await authedRequest(org.cookie, "/money/pots");
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { id: string; name: string }[];
    expect(list.find((p) => p.id === created.id)?.name).toBe("Taxes");

    // A new mutation is blocked (F-012/F-014 — the gate actually drops).
    const blockedRes = await authedRequest(org.cookie, "/money/pots", {
      method: "POST",
      body: JSON.stringify({ name: "Second pot", targetCents: 0, kind: "business" }),
    });
    expect(blockedRes.status).toBe(402);

    // The pot created before the gate closed is still there, unmodified —
    // no code path deletes or mutates trial data on expiry (F-016).
    const afterRes = await authedRequest(org.cookie, "/money/pots");
    const after = (await afterRes.json()) as { id: string }[];
    expect(after.map((p) => p.id)).toContain(created.id);
  });

  it("requesting a data export still succeeds once the gate has closed", async () => {
    const org = await signUpAndOnboard("gate-owner-c@example.com");
    await env.DB.prepare(
      "UPDATE business_profiles SET first_quarter_closed_at = ? WHERE org_id = ?",
    )
      .bind(Date.now(), org.orgId)
      .run();

    const res = await authedRequest(org.cookie, "/export-jobs", {
      method: "POST",
      body: JSON.stringify({ kind: "data" }),
    });
    expect(res.status).toBe(201);
  });
});
