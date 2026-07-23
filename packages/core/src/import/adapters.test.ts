import { describe, expect, it } from "vitest";
import { detectImportAdapter, NAMED_IMPORT_ADAPTERS } from "./adapters";

describe("named import adapter registry", () => {
  it("registers exactly the three named adapters the plan requires", () => {
    expect(NAMED_IMPORT_ADAPTERS.map((a) => a.id).sort()).toEqual([
      "declair",
      "eboekhouden",
      "moneybird",
    ]);
  });

  it("no adapter ever falsely detects a header row (they're unimplemented, not guessed)", () => {
    const someHeader = ["Datum", "Omschrijving", "Bedrag", "Btw"];
    expect(detectImportAdapter(someHeader)).toBeNull();
  });
});

// BLOCKED: docs/import-formats/ has no sample exports yet. Each skip below
// is the marker the plan asks for — replace with a real fixture-driven
// golden test (detect() true on the real header, parse() mapping real rows
// correctly) the moment a sample lands, per adapter.
describe.skip("moneybird adapter — blocked on docs/import-formats/moneybird-sample.csv", () => {
  it("detects the Moneybird export header and maps rows to income/expense lines", () => {
    // TODO: load docs/import-formats/moneybird-sample.csv once provided.
  });
});

describe.skip("declair adapter — blocked on docs/import-formats/declair-sample.csv", () => {
  it("detects the Declair export header and maps rows to income/expense lines", () => {
    // TODO: load docs/import-formats/declair-sample.csv once provided.
  });
});

describe.skip("eboekhouden adapter — blocked on docs/import-formats/eboekhouden-sample.csv", () => {
  it("detects the e-Boekhouden export header and maps rows to income/expense lines", () => {
    // TODO: load docs/import-formats/eboekhouden-sample.csv once provided.
  });
});
