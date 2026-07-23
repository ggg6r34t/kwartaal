import { describe, expect, it } from "vitest";
import { deadlinesForYear } from "./deadlines";

describe("deadlinesForYear — btw quarters", () => {
  it("computes all four quarterly due dates for a non-KOR org", () => {
    const deadlines = deadlinesForYear({ korOptIn: false }, 2026);
    const btw = deadlines.filter((d) => d.kind === "btw_q");
    expect(btw).toEqual([
      { kind: "btw_q", dueDate: "2026-04-30", quarter: 1 },
      { kind: "btw_q", dueDate: "2026-07-31", quarter: 2 },
      { kind: "btw_q", dueDate: "2026-10-31", quarter: 3 },
      { kind: "btw_q", dueDate: "2027-01-31", quarter: 4 },
    ]);
  });

  it("year rollover: Q4 belongs to `year` but is due 31 Jan of year+1", () => {
    const deadlines = deadlinesForYear({ korOptIn: false }, 2026);
    const q4 = deadlines.find((d) => d.quarter === 4)!;
    expect(q4.dueDate).toBe("2027-01-31");
    expect(q4.dueDate.startsWith("2027")).toBe(true);
  });

  it("KOR orgs get no btw deadlines at all", () => {
    const deadlines = deadlinesForYear({ korOptIn: true }, 2026);
    expect(deadlines.some((d) => d.kind === "btw_q")).toBe(false);
  });
});

describe("deadlinesForYear — income tax", () => {
  it("is always due 1 May of the following year, regardless of KOR status", () => {
    for (const korOptIn of [true, false]) {
      const deadlines = deadlinesForYear({ korOptIn }, 2026);
      const incomeTax = deadlines.find((d) => d.kind === "income_tax")!;
      expect(incomeTax.dueDate).toBe("2027-05-01");
    }
  });
});

describe("deadlinesForYear — voorlopige aanslag", () => {
  it("adds no monthly deadlines when inactive or unset", () => {
    expect(
      deadlinesForYear({ korOptIn: false }, 2026).some(
        (d) => d.kind === "voorlopige_aanslag",
      ),
    ).toBe(false);
    expect(
      deadlinesForYear(
        { korOptIn: false, voorlopigeAanslag: { active: false, startMonth: 1 } },
        2026,
      ).some((d) => d.kind === "voorlopige_aanslag"),
    ).toBe(false);
  });

  it("adds one monthly deadline per remaining month from startMonth through December", () => {
    const deadlines = deadlinesForYear(
      { korOptIn: false, voorlopigeAanslag: { active: true, startMonth: 10 } },
      2026,
    );
    const va = deadlines.filter((d) => d.kind === "voorlopige_aanslag");
    expect(va.map((d) => d.dueDate)).toEqual(["2026-10-31", "2026-11-30", "2026-12-31"]);
  });

  it("handles February correctly in a leap year", () => {
    const deadlines = deadlinesForYear(
      { korOptIn: false, voorlopigeAanslag: { active: true, startMonth: 2 } },
      2028, // leap year
    );
    const feb = deadlines.find(
      (d) => d.kind === "voorlopige_aanslag" && d.dueDate.startsWith("2028-02"),
    );
    expect(feb!.dueDate).toBe("2028-02-29");
  });
});
