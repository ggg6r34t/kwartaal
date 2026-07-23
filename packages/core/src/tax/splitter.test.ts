import { describe, expect, it } from "vitest";
import { splitInvoice } from "./splitter";

describe("splitInvoice — worked example", () => {
  it("splits a €1.000 invoice at 21% VAT with a 30% reserve rate", () => {
    const result = splitInvoice(100000, 21, 3000);
    // vat = 100000 * 21/121 = 17355.37... -> 17355
    expect(result.vatCents).toBe(17355);
    // exVat = 100000 - 17355 = 82645; reserve = 82645 * 0.3 = 24793.5 -> 24794 (half-up)
    expect(result.reserveCents).toBe(24794);
    expect(result.yoursCents).toBe(100000 - 17355 - 24794);
  });

  it("a 0% invoice has zero VAT and the reserve applies to the full total", () => {
    const result = splitInvoice(100000, 0, 3000);
    expect(result.vatCents).toBe(0);
    expect(result.reserveCents).toBe(30000);
    expect(result.yoursCents).toBe(70000);
  });
});

describe("splitInvoice — property: the three bands always sum to the total", () => {
  it("holds across randomized totals, VAT rates, and reserve rates", () => {
    const rates = [21, 9, 0] as const;
    for (let i = 0; i < 500; i++) {
      const totalCents = Math.floor(Math.random() * 10_000_000);
      const vatRate = rates[Math.floor(Math.random() * rates.length)]!;
      const reserveRateBps = Math.floor(Math.random() * 5000); // 0-50%
      const result = splitInvoice(totalCents, vatRate, reserveRateBps);
      expect(result.yoursCents + result.vatCents + result.reserveCents).toBe(totalCents);
    }
  });

  it("never produces a negative vat or reserve band", () => {
    for (let i = 0; i < 500; i++) {
      const totalCents = Math.floor(Math.random() * 10_000_000);
      const vatRate = ([21, 9, 0] as const)[Math.floor(Math.random() * 3)]!;
      const reserveRateBps = Math.floor(Math.random() * 5000);
      const result = splitInvoice(totalCents, vatRate, reserveRateBps);
      expect(result.vatCents).toBeGreaterThanOrEqual(0);
      expect(result.reserveCents).toBeGreaterThanOrEqual(0);
    }
  });
});
