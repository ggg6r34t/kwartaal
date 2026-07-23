import { describe, expect, it } from "vitest";
import { hasProAccess } from "./entitlement";

describe("hasProAccess", () => {
  it("grants access during the trial (no quarter closed yet)", () => {
    expect(hasProAccess({ activeSubscription: false, firstQuarterClosedAt: null })).toBe(
      true,
    );
  });

  it("blocks access once the trial-closing quarter has closed with no subscription", () => {
    expect(
      hasProAccess({
        activeSubscription: false,
        firstQuarterClosedAt: "2026-10-22",
      }),
    ).toBe(false);
  });

  it("grants access with an active subscription regardless of trial state", () => {
    expect(
      hasProAccess({
        activeSubscription: true,
        firstQuarterClosedAt: "2026-10-22",
      }),
    ).toBe(true);
  });

  it("grants access with an active subscription even pre-trial-close", () => {
    expect(hasProAccess({ activeSubscription: true, firstQuarterClosedAt: null })).toBe(
      true,
    );
  });
});
