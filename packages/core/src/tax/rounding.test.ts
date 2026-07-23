import { describe, expect, it } from "vitest";
import { bpsOfCents, roundHalfUp, vatCentsForRate } from "./rounding";

describe("roundHalfUp", () => {
  it("rounds .5 up, not to even (not banker's rounding)", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(3.5)).toBe(4);
  });
});

describe("vatCentsForRate", () => {
  it("rounds a fractional-cent result to the nearest cent", () => {
    // 944.44 * 0.09 = 84.9996 -> 85 cents when amount is in cents (94444 * 9 / 100 = 8499.96 -> 8500)
    expect(vatCentsForRate(94444, 9)).toBe(8500);
  });

  it("computes a clean 21% line exactly", () => {
    expect(vatCentsForRate(1950000, 21)).toBe(409500);
  });

  it("returns zero for 0%", () => {
    expect(vatCentsForRate(100000, 0)).toBe(0);
  });
});

describe("bpsOfCents", () => {
  it("applies a basis-points rate and rounds to the nearest cent", () => {
    // 5,917,700 * 1270bps (12.7%) = 751,547.9 -> 751,548
    expect(bpsOfCents(5917700, 1270)).toBe(751548);
  });
});
