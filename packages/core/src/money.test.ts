import { describe, expect, it } from "vitest";
import { formatCents, parseAmountToCents } from "./money";

describe("parseAmountToCents", () => {
  it("parses Dutch notation with thousands dot and comma decimal", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123456);
  });
  it("parses plain dot-decimal notation", () => {
    expect(parseAmountToCents("1234.56")).toBe(123456);
  });
  it("parses plain comma-decimal notation", () => {
    expect(parseAmountToCents("1234,56")).toBe(123456);
  });
  it("parses an integer with no separator", () => {
    expect(parseAmountToCents("72000")).toBe(7200000);
  });
  it("throws on empty input", () => {
    expect(() => parseAmountToCents("")).toThrow();
  });
  it("throws on garbage input", () => {
    expect(() => parseAmountToCents("not a number")).toThrow();
  });
});

describe("formatCents", () => {
  it("formats cents as Dutch currency, thousands-dot and comma-decimal", () => {
    // Whitespace between the € symbol and the figure is locale/ICU-version
    // dependent (plain space vs NBSP), so strip all whitespace before
    // comparing rather than asserting on it.
    const collapsed = formatCents(123456).replace(/\s/g, "");
    expect(collapsed).toBe("€1.234,56");
  });

  it("round-trips through parseAmountToCents", () => {
    expect(parseAmountToCents(formatCents(7200000).replace(/[^\d,.-]/g, ""))).toBe(
      7200000,
    );
  });
});
