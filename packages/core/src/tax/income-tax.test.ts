import { describe, expect, it } from "vitest";
import { estimateIncomeTax } from "./income-tax";
import { MAYA_TAX_FIGURES_2026 } from "./maya-fixtures";

const MAYA_TAXABLE_CENTS = 5166152; // from waterfall.test.ts's golden figure

describe("estimateIncomeTax — shape", () => {
  it("returns one bracket fill per configured bracket, summing to taxable income", () => {
    const result = estimateIncomeTax(MAYA_TAXABLE_CENTS, MAYA_TAX_FIGURES_2026);
    expect(result.bracketFills).toHaveLength(MAYA_TAX_FIGURES_2026.brackets.length);
    const totalFilled = result.bracketFills.reduce((sum, f) => sum + f.filledCents, 0);
    expect(totalFilled).toBe(MAYA_TAXABLE_CENTS);
  });

  it("fills brackets in order, lower brackets first, never exceeding a bracket's size", () => {
    const result = estimateIncomeTax(MAYA_TAXABLE_CENTS, MAYA_TAX_FIGURES_2026);
    const first = result.bracketFills[0]!;
    expect(first.filledCents).toBe(MAYA_TAX_FIGURES_2026.brackets[0]!.uptoCents);
  });

  it("setAsideCents is never negative even when credits exceed tax + Zvw", () => {
    const result = estimateIncomeTax(0, MAYA_TAX_FIGURES_2026);
    expect(result.setAsideCents).toBeGreaterThanOrEqual(0);
  });

  it("payrollWithheldCents reduces the set-aside total without changing bracket fills or credits", () => {
    const withoutPayroll = estimateIncomeTax(
      MAYA_TAXABLE_CENTS,
      MAYA_TAX_FIGURES_2026,
      0,
    );
    const withPayroll = estimateIncomeTax(
      MAYA_TAXABLE_CENTS,
      MAYA_TAX_FIGURES_2026,
      100000,
    );
    expect(withPayroll.bracketFills).toEqual(withoutPayroll.bracketFills);
    expect(withPayroll.creditsCents).toBe(withoutPayroll.creditsCents);
    expect(withPayroll.setAsideCents).toBe(
      Math.max(withoutPayroll.setAsideCents - 100000, 0),
    );
  });

  it("a negative taxable amount fills zero brackets and produces zero tax", () => {
    const result = estimateIncomeTax(-500000, MAYA_TAX_FIGURES_2026);
    expect(result.bracketFills.every((f) => f.filledCents === 0)).toBe(true);
    expect(result.zvwCents).toBe(0);
  });
});
