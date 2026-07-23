import { describe, expect, it } from "vitest";
import { computeQuarter } from "./vat";
import { MAYA_Q3_EXPENSE_LINES, MAYA_Q3_INCOME_LINES } from "./maya-fixtures";
import type { ExpenseLineInput, IncomeLineInput } from "./types";

describe("computeQuarter — Maya Q3 golden fixture", () => {
  it("pins rubriek 1a/1b/5b/5c exactly to locked decision #4", () => {
    const result = computeQuarter(MAYA_Q3_INCOME_LINES, MAYA_Q3_EXPENSE_LINES);

    expect(result.rubriek1aCents).toBe(409500); // €4.095,00
    expect(result.rubriek1bCents).toBe(4500); // €45,00
    expect(result.rubriek5bCents).toBe(61000); // €610,00
    expect(result.rubriek5cCents).toBe(353000); // €3.530,00 (4140 - 610)
  });

  it("combined 1a+1b equals the plan's stated €4.140 btw-received figure", () => {
    const result = computeQuarter(MAYA_Q3_INCOME_LINES, MAYA_Q3_EXPENSE_LINES);
    expect(result.rubriek1aCents + result.rubriek1bCents).toBe(414000);
  });
});

describe("computeQuarter — exempt and 0% lines", () => {
  it("exempt income lines contribute zero VAT and don't affect any rubriek", () => {
    const income: IncomeLineInput[] = [{ amountExVatCents: 100000, vatRate: "exempt" }];
    const result = computeQuarter(income, []);
    expect(result.perLineVatCents).toEqual([0]);
    expect(result.rubriek1aCents).toBe(0);
    expect(result.rubriek1bCents).toBe(0);
  });

  it("0% income lines contribute zero VAT", () => {
    const income: IncomeLineInput[] = [{ amountExVatCents: 100000, vatRate: 0 }];
    const result = computeQuarter(income, []);
    expect(result.perLineVatCents).toEqual([0]);
  });

  it("exempt and 0% expense lines never contribute voorbelasting, even if marked reclaimable", () => {
    const expenses: ExpenseLineInput[] = [
      { amountExVatCents: 50000, vatRate: "exempt", vatReclaimable: true },
      { amountExVatCents: 50000, vatRate: 0, vatReclaimable: true },
    ];
    const result = computeQuarter([], expenses);
    expect(result.rubriek5bCents).toBe(0);
  });

  it("a non-reclaimable expense line contributes zero to rubriek 5b regardless of rate", () => {
    const expenses: ExpenseLineInput[] = [
      { amountExVatCents: 50000, vatRate: 21, vatReclaimable: false },
    ];
    const result = computeQuarter([], expenses);
    expect(result.rubriek5bCents).toBe(0);
  });
});

describe("computeQuarter — property: rubriek 5c is always 1a + 1b - 5b", () => {
  it("holds across randomized line sets", () => {
    const rateChoices = [21, 9, 0, "exempt"] as const;
    for (let i = 0; i < 100; i++) {
      const income: IncomeLineInput[] = Array.from(
        { length: Math.floor(Math.random() * 5) },
        () => ({
          amountExVatCents: Math.floor(Math.random() * 1_000_000),
          vatRate: rateChoices[Math.floor(Math.random() * rateChoices.length)]!,
        }),
      );
      const expenses: ExpenseLineInput[] = Array.from(
        { length: Math.floor(Math.random() * 5) },
        () => ({
          amountExVatCents: Math.floor(Math.random() * 1_000_000),
          vatRate: rateChoices[Math.floor(Math.random() * rateChoices.length)]!,
          vatReclaimable: Math.random() > 0.5,
        }),
      );

      const result = computeQuarter(income, expenses);
      expect(result.rubriek5cCents).toBe(
        result.rubriek1aCents + result.rubriek1bCents - result.rubriek5bCents,
      );
    }
  });
});
