import { describe, expect, it } from "vitest";
import { authedRequest, signUpAndOnboard } from "./helpers";

/**
 * "PINS the unsplit payment to Today until confirmed moved (verify
 * persistence)" — Moment 3's split ritual. "I moved it — done" persists a
 * confirmed entry immediately; "Remind me tonight" persists a pending one
 * that stays pinned until a later confirm.
 */
describe("set-aside entry status (pinned-split persistence)", () => {
  it("defaults to confirmed when status is omitted", async () => {
    const org = await signUpAndOnboard("pin-owner-a@example.com");

    const res = await authedRequest(org.cookie, "/money/set-aside-entries", {
      method: "POST",
      body: JSON.stringify({
        invoiceRef: "2026-014",
        totalCents: 242000,
        vatRate: 21,
        reserveRateBps: 3000,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; status: string };
    expect(body.status).toBe("confirmed");
  });

  it('persists a pending entry when the user chooses "remind me tonight"', async () => {
    const org = await signUpAndOnboard("pin-owner-b@example.com");

    const createRes = await authedRequest(org.cookie, "/money/set-aside-entries", {
      method: "POST",
      body: JSON.stringify({
        invoiceRef: "2026-015",
        totalCents: 242000,
        vatRate: 21,
        reserveRateBps: 3000,
        status: "pending",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; status: string };
    expect(created.status).toBe("pending");

    // Still pending on a fresh read — it stays pinned to Today until confirmed.
    const listRes = await authedRequest(org.cookie, "/money/set-aside-entries");
    const list = (await listRes.json()) as { id: string; status: string }[];
    expect(list.find((e) => e.id === created.id)?.status).toBe("pending");
  });

  it("confirming a pending entry flips it to confirmed and unpins it", async () => {
    const org = await signUpAndOnboard("pin-owner-c@example.com");

    const createRes = await authedRequest(org.cookie, "/money/set-aside-entries", {
      method: "POST",
      body: JSON.stringify({
        invoiceRef: "2026-016",
        totalCents: 242000,
        vatRate: 21,
        reserveRateBps: 3000,
        status: "pending",
      }),
    });
    const created = (await createRes.json()) as { id: string };

    const confirmRes = await authedRequest(
      org.cookie,
      `/money/set-aside-entries/${created.id}`,
      { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) },
    );
    expect(confirmRes.status).toBe(200);
    const confirmed = (await confirmRes.json()) as { status: string };
    expect(confirmed.status).toBe("confirmed");

    const listRes = await authedRequest(org.cookie, "/money/set-aside-entries");
    const list = (await listRes.json()) as { id: string; status: string }[];
    expect(list.find((e) => e.id === created.id)?.status).toBe("confirmed");
  });

  it("404s confirming an entry that doesn't exist", async () => {
    const org = await signUpAndOnboard("pin-owner-d@example.com");
    const res = await authedRequest(org.cookie, "/money/set-aside-entries/nope", {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    });
    expect(res.status).toBe(404);
  });
});
