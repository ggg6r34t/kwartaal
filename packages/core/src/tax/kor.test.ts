import { describe, expect, it } from "vitest";
import { korRollingTurnover } from "./kor";

const LIMIT = 2_000_000; // €20.000,00

describe("korRollingTurnover", () => {
  it("sums only lines within the given calendar year", () => {
    const lines = [
      { amountExVatCents: 500000, date: "2026-03-01" },
      { amountExVatCents: 300000, date: "2026-06-01" },
      { amountExVatCents: 999999, date: "2025-12-31" }, // excluded — previous year
      { amountExVatCents: 999999, date: "2027-01-01" }, // excluded — next year
    ];
    const result = korRollingTurnover(lines, 2026, LIMIT);
    expect(result.rollingTurnoverCents).toBe(800000);
  });

  it("does not cross the warning threshold below €18.000 (90%)", () => {
    const lines = [{ amountExVatCents: 1_700_000, date: "2026-05-01" }]; // 85%
    const result = korRollingTurnover(lines, 2026, LIMIT);
    expect(result.crossedWarningThreshold).toBe(false);
    expect(result.crossedLimit).toBe(false);
  });

  it("flags crossedWarningThreshold at exactly €18.000 (docs/design's onboarding copy)", () => {
    const lines = [{ amountExVatCents: 1_800_000, date: "2026-05-01" }]; // exactly 90%
    const result = korRollingTurnover(lines, 2026, LIMIT);
    expect(result.crossedWarningThreshold).toBe(true);
    expect(result.crossedLimit).toBe(false);
  });

  it("flags crossedLimit at exactly the limit", () => {
    const lines = [{ amountExVatCents: LIMIT, date: "2026-05-01" }];
    const result = korRollingTurnover(lines, 2026, LIMIT);
    expect(result.crossedLimit).toBe(true);
  });

  it("flags crossedLimit once turnover exceeds the limit", () => {
    const lines = [{ amountExVatCents: LIMIT + 1, date: "2026-05-01" }];
    const result = korRollingTurnover(lines, 2026, LIMIT);
    expect(result.crossedLimit).toBe(true);
  });

  it("computes pctBps as basis points of the limit", () => {
    const lines = [{ amountExVatCents: 1_430_000, date: "2026-05-01" }]; // 71.5%
    const result = korRollingTurnover(lines, 2026, LIMIT);
    expect(result.pctBps).toBe(7150);
  });
});
