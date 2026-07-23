import { describe, expect, it } from "vitest";
import { parseGenericExpenseCsv, parseGenericIncomeCsv } from "./generic";
import type { GenericCsvMapping } from "./types";

const mapping: GenericCsvMapping = { date: 0, label: 1, amountExVatCents: 2, vatRate: 3 };

describe("parseGenericIncomeCsv", () => {
  it("parses valid rows into income lines", () => {
    const rows = [
      ["2026-08-05", "Consulting", "1950,00", "21"],
      ["2026-09-10", "Workshop", "500,00", "9%"],
    ];
    const result = parseGenericIncomeCsv(rows, mapping);
    expect(result.errors).toEqual([]);
    expect(result.lines).toEqual([
      {
        date: "2026-08-05",
        description: "Consulting",
        amountExVatCents: 195000,
        vatRate: 21,
      },
      {
        date: "2026-09-10",
        description: "Workshop",
        amountExVatCents: 50000,
        vatRate: 9,
      },
    ]);
  });

  it("recognizes exempt in both English and Dutch", () => {
    const result = parseGenericIncomeCsv(
      [
        ["2026-08-05", "A", "100,00", "exempt"],
        ["2026-08-06", "B", "100,00", "vrijgesteld"],
      ],
      mapping,
    );
    expect(result.errors).toEqual([]);
    expect(result.lines.map((l) => l.vatRate)).toEqual(["exempt", "exempt"]);
  });

  it("rejects the whole batch when any row is invalid, with row-level errors identifying each problem", () => {
    const rows = [
      ["2026-08-05", "Consulting", "1950,00", "21"], // valid
      ["not-a-date", "Bad row", "abc", "15"], // bad date, bad amount, bad rate (description itself is fine)
    ];
    const result = parseGenericIncomeCsv(rows, mapping);
    expect(result.lines).toEqual([]); // atomic: nothing imports if anything fails
    expect(result.errors).toHaveLength(3);
    expect(result.errors.every((e) => e.rowIndex === 1)).toBe(true);
  });

  it("flags an empty description", () => {
    const result = parseGenericIncomeCsv([["2026-08-05", "", "100,00", "21"]], mapping);
    expect(result.errors).toEqual([{ rowIndex: 0, message: "description is empty" }]);
  });
});

describe("parseGenericExpenseCsv", () => {
  it("parses valid rows into expense lines, deriving vatReclaimable from the rate", () => {
    const rows = [
      ["2026-08-12", "Co-working space", "2500,00", "21"],
      ["2026-08-13", "Public transport", "50,00", "0"],
    ];
    const result = parseGenericExpenseCsv(rows, mapping);
    expect(result.errors).toEqual([]);
    expect(result.lines).toEqual([
      {
        date: "2026-08-12",
        supplier: "Co-working space",
        amountExVatCents: 250000,
        vatRate: 21,
        vatReclaimable: true,
      },
      {
        date: "2026-08-13",
        supplier: "Public transport",
        amountExVatCents: 5000,
        vatRate: 0,
        vatReclaimable: false,
      },
    ]);
  });

  it("flags an empty supplier", () => {
    const result = parseGenericExpenseCsv([["2026-08-12", "", "100,00", "21"]], mapping);
    expect(result.errors).toEqual([{ rowIndex: 0, message: "supplier is empty" }]);
  });
});
