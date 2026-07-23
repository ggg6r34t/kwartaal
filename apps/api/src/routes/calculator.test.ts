import { describe, expect, it } from "vitest";
import { calculator } from "./calculator";

describe("POST /calculator/set-aside", () => {
  it("returns a split whose bands sum to the total", async () => {
    const res = await calculator.request("/set-aside", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalCents: 100000, vatRate: 21, reserveRateBps: 3000 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      yoursCents: number;
      vatCents: number;
      reserveCents: number;
    }>();
    expect(body.yoursCents + body.vatCents + body.reserveCents).toBe(100000);
    expect(body.vatCents).toBe(17355);
  });

  it("rejects an invalid VAT rate with 400", async () => {
    const res = await calculator.request("/set-aside", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalCents: 100000, vatRate: 15, reserveRateBps: 3000 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a negative total with 400", async () => {
    const res = await calculator.request("/set-aside", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalCents: -100, vatRate: 21, reserveRateBps: 3000 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a reserve rate above 100%", async () => {
    const res = await calculator.request("/set-aside", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalCents: 100000, vatRate: 21, reserveRateBps: 10001 }),
    });
    expect(res.status).toBe(400);
  });
});
