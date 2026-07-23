import { describe, expect, it } from "vitest";
import { computeWaterfall } from "./waterfall";
import { MAYA_TAX_FIGURES_2026, MAYA_WATERFALL_INPUT } from "./maya-fixtures";
import type { WaterfallInput } from "./types";

describe("computeWaterfall — Maya golden fixture", () => {
  it("pins 62.500 -> 61.300 -> 59.177 exactly (locked decision #4)", () => {
    const steps = computeWaterfall(MAYA_WATERFALL_INPUT, MAYA_TAX_FIGURES_2026);

    const zelfstandigenaftrek = steps[0]!;
    expect(zelfstandigenaftrek.eligible).toBe(true);
    expect(zelfstandigenaftrek.amountCents).toBe(-120000);
    expect(zelfstandigenaftrek.runningTotalCents).toBe(6130000); // €61.300,00

    const startersaftrek = steps[1]!;
    expect(startersaftrek.eligible).toBe(true);
    expect(startersaftrek.amountCents).toBe(-212300);
    expect(startersaftrek.runningTotalCents).toBe(5917700); // €59.177,00
  });

  it("pins the taxable figure to this implementation's rounding convention (see docs/rounding.md)", () => {
    const steps = computeWaterfall(MAYA_WATERFALL_INPUT, MAYA_TAX_FIGURES_2026);
    const mkb = steps[2]!;
    expect(mkb.label).toBe("MKB-winstvrijstelling");
    expect(mkb.amountCents).toBe(-751548);
    expect(mkb.runningTotalCents).toBe(5166152); // €51.661,52 — within the plan's own "±€51.660"
  });
});

describe("computeWaterfall — eligibility gates", () => {
  it("makes zelfstandigenaftrek and startersaftrek ineligible when urencriterium isn't met", () => {
    const input: WaterfallInput = { ...MAYA_WATERFALL_INPUT, hoursLogged: 800 };
    const steps = computeWaterfall(input, MAYA_TAX_FIGURES_2026);
    expect(steps[0]!.eligible).toBe(false);
    expect(steps[0]!.reason).toMatch(/urencriterium/);
    expect(steps[1]!.eligible).toBe(false);
    // Running total is untouched by the ineligible steps.
    expect(steps[0]!.runningTotalCents).toBe(MAYA_WATERFALL_INPUT.profitCents);
  });

  it("makes startersaftrek ineligible once used 3 times", () => {
    const input: WaterfallInput = { ...MAYA_WATERFALL_INPUT, startersaftrekUsedCount: 3 };
    const steps = computeWaterfall(input, MAYA_TAX_FIGURES_2026);
    expect(steps[1]!.eligible).toBe(false);
    expect(steps[1]!.reason).toMatch(/already used/);
  });

  it("makes startersaftrek ineligible outside the first 5 years since KVK registration", () => {
    const input: WaterfallInput = { ...MAYA_WATERFALL_INPUT, asOfYear: 2032 };
    const steps = computeWaterfall(input, MAYA_TAX_FIGURES_2026);
    expect(steps[1]!.eligible).toBe(false);
    expect(steps[1]!.reason).toMatch(/first 5 years/);
  });

  it("treats a null KVK registration date as starters-ineligible", () => {
    const input: WaterfallInput = { ...MAYA_WATERFALL_INPUT, kvkRegisteredAt: null };
    const steps = computeWaterfall(input, MAYA_TAX_FIGURES_2026);
    expect(steps[1]!.eligible).toBe(false);
  });

  it("MKB-winstvrijstelling has no eligibility gate — always eligible", () => {
    const input: WaterfallInput = { ...MAYA_WATERFALL_INPUT, hoursLogged: 0 };
    const steps = computeWaterfall(input, MAYA_TAX_FIGURES_2026);
    expect(steps[2]!.eligible).toBe(true);
  });
});

describe("computeWaterfall — property: the running total never goes negative", () => {
  it("holds across randomized profit/hours/starters inputs, including a zero and negative profit", () => {
    for (let i = 0; i < 200; i++) {
      const input: WaterfallInput = {
        profitCents: Math.floor(Math.random() * 300000) - 150000, // can be negative
        hoursLogged: Math.floor(Math.random() * 2000),
        startersaftrekUsedCount: Math.floor(Math.random() * 5),
        kvkRegisteredAt: Math.random() > 0.1 ? "2024-01-01" : null,
        asOfYear: 2026,
      };
      const steps = computeWaterfall(input, MAYA_TAX_FIGURES_2026);
      for (const step of steps) {
        expect(step.runningTotalCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
