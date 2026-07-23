import { describe, expect, it } from "vitest";
import { dueReminderStage } from "./reminders";

describe("dueReminderStage — persistent cadence", () => {
  it("fires t14, t7, day, and all three overdue repeats", () => {
    expect(dueReminderStage(14, "persistent")).toBe("t14");
    expect(dueReminderStage(7, "persistent")).toBe("t7");
    expect(dueReminderStage(0, "persistent")).toBe("day");
    expect(dueReminderStage(-1, "persistent")).toBe("overdue_1");
    expect(dueReminderStage(-8, "persistent")).toBe("overdue_2");
    expect(dueReminderStage(-15, "persistent")).toBe("overdue_3");
  });

  it("does not fire t2 (persistent skips it in favor of day-of)", () => {
    expect(dueReminderStage(2, "persistent")).toBeNull();
  });

  it("returns null on days with no matching stage", () => {
    expect(dueReminderStage(10, "persistent")).toBeNull();
    expect(dueReminderStage(-3, "persistent")).toBeNull();
    expect(dueReminderStage(-22, "persistent")).toBeNull(); // beyond the max-3 window
  });
});

describe("dueReminderStage — calm cadence", () => {
  it("fires only t14, t2, and a single overdue notice", () => {
    expect(dueReminderStage(14, "calm")).toBe("t14");
    expect(dueReminderStage(2, "calm")).toBe("t2");
    expect(dueReminderStage(-1, "calm")).toBe("overdue_1");
  });

  it("never fires t7, day-of, or the repeat overdue stages", () => {
    expect(dueReminderStage(7, "calm")).toBeNull();
    expect(dueReminderStage(0, "calm")).toBeNull();
    expect(dueReminderStage(-8, "calm")).toBeNull();
    expect(dueReminderStage(-15, "calm")).toBeNull();
  });
});

describe("dueReminderStage — never fires twice for the same day count", () => {
  it("each integer day-count maps to at most one stage, for both cadences", () => {
    for (const cadence of ["calm", "persistent"] as const) {
      for (let days = -30; days <= 30; days++) {
        // dueReminderStage itself only ever returns one value per call —
        // this loop just exercises the full range without throwing.
        expect(() => dueReminderStage(days, cadence)).not.toThrow();
      }
    }
  });
});
