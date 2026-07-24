import { describe, expect, it } from "vitest";
import { authedRequest, signUpAndOnboard } from "./helpers";

async function uploadReceipt(cookie: string): Promise<string> {
  const res = await authedRequest(cookie, "/receipts", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array([1, 2, 3, 4]),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { id: string };
  return body.id;
}

/**
 * "The note-fallback rule": no OCR in v1 (locked decision #9) — amount is
 * typed in on review, and a receipt missing an element can still be saved
 * by recording why, alongside the photo.
 */
describe("receipt amount + note fallback", () => {
  it("sets amountCents and note via PATCH /receipts/:id/details", async () => {
    const org = await signUpAndOnboard("receipt-owner-a@example.com");
    const id = await uploadReceipt(org.cookie);

    const res = await authedRequest(org.cookie, `/receipts/${id}/details`, {
      method: "PATCH",
      body: JSON.stringify({
        amountCents: 18585,
        note: "Client meeting lunch, my name wasn't on the receipt.",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { amountCents: number; note: string };
    expect(body.amountCents).toBe(18585);
    expect(body.note).toBe("Client meeting lunch, my name wasn't on the receipt.");

    const listRes = await authedRequest(org.cookie, "/receipts");
    const list = (await listRes.json()) as { id: string; amountCents: number | null }[];
    expect(list.find((r) => r.id === id)?.amountCents).toBe(18585);
  });

  it("allows setting only the amount, leaving note null", async () => {
    const org = await signUpAndOnboard("receipt-owner-b@example.com");
    const id = await uploadReceipt(org.cookie);

    const res = await authedRequest(org.cookie, `/receipts/${id}/details`, {
      method: "PATCH",
      body: JSON.stringify({ amountCents: 4500 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { amountCents: number; note: string | null };
    expect(body.amountCents).toBe(4500);
    expect(body.note).toBeNull();
  });

  it("rejects an empty note (min length 1)", async () => {
    const org = await signUpAndOnboard("receipt-owner-c@example.com");
    const id = await uploadReceipt(org.cookie);

    const res = await authedRequest(org.cookie, `/receipts/${id}/details`, {
      method: "PATCH",
      body: JSON.stringify({ note: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("404s for a receipt that doesn't exist", async () => {
    const org = await signUpAndOnboard("receipt-owner-d@example.com");
    const res = await authedRequest(org.cookie, "/receipts/nope/details", {
      method: "PATCH",
      body: JSON.stringify({ amountCents: 100 }),
    });
    expect(res.status).toBe(404);
  });
});
