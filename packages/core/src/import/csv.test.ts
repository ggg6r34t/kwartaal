import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated grid", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(
      parseCsv('date,description,amount\n2026-08-05,"Consulting, August",1950.00'),
    ).toEqual([
      ["date", "description", "amount"],
      ["2026-08-05", "Consulting, August", "1950.00"],
    ]);
  });

  it("handles escaped double quotes inside a quoted field", () => {
    expect(parseCsv('a,b\n1,"say ""hi"""')).toEqual([
      ["a", "b"],
      ["1", 'say "hi"'],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
