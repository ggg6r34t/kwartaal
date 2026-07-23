import { describe, expect, it } from "vitest";
import { authedRequest, inviteAndAcceptBookkeeper, signUpAndOnboard } from "./helpers";

/**
 * Definition of Done: "Bookkeeper role can read and export, and every
 * mutation attempt returns 403 by test." Every mutation route in the app
 * is probed here exhaustively (see the grep this list was built from) —
 * not a sample — specifically because writing this test is what caught
 * `POST /onboarding/complete` missing its `requireRole("owner")` guard
 * (fixed in the same commit as this test, not left as a known gap).
 */
describe("bookkeeper role — mutation-blocked server-side", () => {
  it("reads succeed and every mutation 403s for an invited bookkeeper", async () => {
    const owner = await signUpAndOnboard("bk-owner@example.com");
    const bookkeeperCookie = await inviteAndAcceptBookkeeper(
      owner.cookie,
      "bk-seat@example.com",
    );

    // Sanity: the bookkeeper really did land in the owner's org, not a new one.
    const me = await authedRequest(bookkeeperCookie, "/orgs/me");
    const meBody = (await me.json()) as { org: { id: string }; role: string };
    expect(meBody.org.id).toBe(owner.orgId);
    expect(meBody.role).toBe("bookkeeper");

    // Reads must succeed.
    for (const path of [
      "/quarters?year=2026",
      "/hours-entries",
      "/km-entries",
      "/money/pots",
      "/export-jobs",
    ]) {
      const res = await authedRequest(bookkeeperCookie, path);
      expect(res.status, `GET ${path} should succeed for a bookkeeper`).toBe(200);
    }

    const quartersRes = await authedRequest(bookkeeperCookie, "/quarters?year=2026");
    const quarters = (await quartersRes.json()) as { id: string }[];
    const quarterId = quarters[0]!.id;

    const mutationProbes: { method: string; path: string; body?: unknown }[] = [
      {
        method: "POST",
        path: "/onboarding/complete",
        body: {
          legalForm: "eenmanszaak",
          kvkRegisteredAt: null,
          turnoverEstimateCents: 0,
          korOptIn: false,
          defaultSetAsideRateBps: 3000,
          reminderCadence: "calm",
        },
      },
      {
        method: "POST",
        path: `/quarters/${quarterId}/income-lines`,
        body: {
          date: "2026-07-01",
          description: "x",
          amountExVatCents: 100,
          vatRate: 21,
        },
      },
      {
        method: "POST",
        path: `/quarters/${quarterId}/expense-lines`,
        body: {
          date: "2026-07-01",
          supplier: "x",
          amountExVatCents: 100,
          vatRate: 21,
          vatReclaimable: true,
          isStartupCost: false,
          deductionMode: "expense",
        },
      },
      { method: "POST", path: `/quarters/${quarterId}/file` },
      { method: "POST", path: `/quarters/${quarterId}/pay` },
      { method: "POST", path: `/quarters/${quarterId}/reopen` },
      {
        method: "POST",
        path: "/hours-entries",
        body: { date: "2026-07-01", hours: 1, note: null },
      },
      {
        method: "POST",
        path: "/km-entries",
        body: { date: "2026-07-01", km: 1, purpose: null },
      },
      {
        method: "POST",
        path: "/money/pots",
        body: { name: "x", targetCents: 0, kind: "business" },
      },
      {
        method: "POST",
        path: "/money/set-aside-entries",
        body: { invoiceRef: "x", totalCents: 100, vatRate: 21, reserveRateBps: 3000 },
      },
      {
        method: "PUT",
        path: "/money/voorlopige-aanslag",
        body: { year: 2026, monthlyCents: 100, startMonth: 1, active: true },
      },
      { method: "POST", path: "/export-jobs", body: { kind: "data" } },
      {
        method: "POST",
        path: "/invites",
        body: { email: "second-bookkeeper@example.com" },
      },
      { method: "POST", path: "/billing/checkout-session", body: { interval: "annual" } },
      { method: "POST", path: "/billing/portal-session" },
      { method: "POST", path: "/orgs/deletion-request" },
      { method: "POST", path: "/orgs/deletion-cancel" },
    ];

    for (const probe of mutationProbes) {
      const res = await authedRequest(bookkeeperCookie, probe.path, {
        method: probe.method,
        body: probe.body ? JSON.stringify(probe.body) : undefined,
      });
      expect(
        res.status,
        `${probe.method} ${probe.path} should 403 for a bookkeeper`,
      ).toBe(403);
    }
  });
});
