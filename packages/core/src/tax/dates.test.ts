import { describe, expect, it } from "vitest";
import { amsterdamDateString, daysUntilDue } from "./dates";

describe("amsterdamDateString", () => {
  it("converts a UTC instant to the correct Amsterdam calendar date in winter (CET, UTC+1)", () => {
    expect(amsterdamDateString(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
  });

  it("converts a UTC instant to the correct Amsterdam calendar date in summer (CEST, UTC+2)", () => {
    expect(amsterdamDateString(new Date("2026-07-01T00:00:00Z"))).toBe("2026-07-01");
  });

  it("rolls the calendar date forward across midnight UTC when Amsterdam is already the next day", () => {
    // 23:30 UTC on 31 Dec + 1h CET offset = 00:30 local on 1 Jan — a year rollover across the timezone boundary.
    expect(amsterdamDateString(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

describe("daysUntilDue — DST-safe (the hourly-cron bug the plan calls out)", () => {
  it("is self-consistent: due date == today's Amsterdam date always yields 0", () => {
    // Sample instants spanning both DST regimes and both 2026 transition days.
    const samples = [
      new Date("2026-01-15T10:00:00Z"),
      new Date("2026-03-28T23:00:00Z"), // just before the spring-forward transition
      new Date("2026-03-29T10:00:00Z"), // spring-forward day itself (CET -> CEST)
      new Date("2026-07-15T10:00:00Z"),
      new Date("2026-10-24T23:00:00Z"), // just before the fall-back transition
      new Date("2026-10-25T10:00:00Z"), // fall-back day itself (CEST -> CET)
    ];
    for (const now of samples) {
      expect(daysUntilDue(amsterdamDateString(now), now)).toBe(0);
    }
  });

  it("counts exactly one day across the fall-back DST transition, not zero or two", () => {
    // Same 24-hour UTC gap, straddling the Oct 25 2026 CEST->CET fallback.
    const before = new Date("2026-10-24T10:00:00Z");
    const after = new Date("2026-10-25T10:00:00Z");
    const dueDate = "2026-10-31";
    const daysBefore = daysUntilDue(dueDate, before);
    const daysAfter = daysUntilDue(dueDate, after);
    expect(daysBefore - daysAfter).toBe(1);
  });

  it("counts exactly one day across the spring-forward DST transition", () => {
    const before = new Date("2026-03-28T10:00:00Z");
    const after = new Date("2026-03-29T10:00:00Z");
    const dueDate = "2026-04-30";
    const daysBefore = daysUntilDue(dueDate, before);
    const daysAfter = daysUntilDue(dueDate, after);
    expect(daysBefore - daysAfter).toBe(1);
  });

  it("returns a negative count when overdue", () => {
    expect(daysUntilDue("2026-01-01", new Date("2026-01-05T10:00:00Z"))).toBe(-4);
  });
});
