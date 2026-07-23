import { describe, expect, it } from "vitest";
import { buildDepreciationSchedule } from "./depreciation";

describe("buildDepreciationSchedule — worked example", () => {
  it("prorates a partial first year by months remaining, then straight-lines the rest", () => {
    // €5.000, 5 years, no residual, starting August (5 months remain: Aug-Dec).
    const schedule = buildDepreciationSchedule(500000, 5, 0, 8);
    // max 20%/year of cost = 100000; straight-line = 500000/5 = 100000 -> annual = 100000.
    expect(schedule[0]).toEqual({ year: 1, month: 5, amountCents: 41667 }); // round(100000*5/12)
    expect(schedule[1]).toEqual({ year: 2, month: 12, amountCents: 100000 });
    expect(schedule[2]).toEqual({ year: 3, month: 12, amountCents: 100000 });
    expect(schedule[3]).toEqual({ year: 4, month: 12, amountCents: 100000 });
    expect(schedule[4]).toEqual({ year: 5, month: 12, amountCents: 100000 });
    // Final entry absorbs the remainder rather than its own rounding.
    expect(schedule[5]).toEqual({ year: 6, month: 12, amountCents: 58333 });
  });

  it("caps the annual amount at 20% of cost even if straight-line would exceed it", () => {
    // €1.000 over 2 years would be €500/year straight-line, but the cap is 20% = €200/year.
    const schedule = buildDepreciationSchedule(100000, 2, 0, 1);
    expect(schedule[0]!.amountCents).toBe(20000); // capped, full first year (Jan start = 12 months)
  });

  it("returns an empty schedule when cost equals residual (nothing to depreciate)", () => {
    expect(buildDepreciationSchedule(100000, 5, 100000, 1)).toEqual([]);
  });

  it("subtracts the residual value from the depreciable base", () => {
    const schedule = buildDepreciationSchedule(100000, 1, 20000, 1);
    const total = schedule.reduce((sum, e) => sum + e.amountCents, 0);
    expect(total).toBe(80000);
  });
});

describe("buildDepreciationSchedule — property: the schedule always sums to cost - residual", () => {
  it("holds across randomized cost, years, residual, and start month", () => {
    for (let i = 0; i < 200; i++) {
      const costCents = Math.floor(Math.random() * 2_000_000) + 1000;
      const years = Math.floor(Math.random() * 10) + 1;
      const residualCents = Math.floor(Math.random() * costCents);
      const startMonth = Math.floor(Math.random() * 12) + 1;

      const schedule = buildDepreciationSchedule(
        costCents,
        years,
        residualCents,
        startMonth,
      );
      const total = schedule.reduce((sum, e) => sum + e.amountCents, 0);
      expect(total).toBe(costCents - residualCents);
    }
  });

  it("every entry is non-negative", () => {
    for (let i = 0; i < 200; i++) {
      const costCents = Math.floor(Math.random() * 2_000_000) + 1000;
      const years = Math.floor(Math.random() * 10) + 1;
      const residualCents = Math.floor(Math.random() * costCents);
      const startMonth = Math.floor(Math.random() * 12) + 1;

      const schedule = buildDepreciationSchedule(
        costCents,
        years,
        residualCents,
        startMonth,
      );
      for (const entry of schedule) {
        expect(entry.amountCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
