/**
 * The named-adapter registry (Moneybird, Declair, e-Boekhouden):
 * auto-detected by header signature, mapped straight to income/expense
 * lines, no manual column-mapping step. Adapters are data + a mapping
 * function, so adding a tool is a PR, not a feature — see
 * `GenericCsvMapping`'s manual-mapping path for the fallback that always
 * works.
 *
 * BLOCKED: no sample exports exist yet in docs/import-formats/ (Moneybird,
 * Declair, e-Boekhouden each need one). Per the plan's instruction, these
 * ship last within Pillar 3, and until real headers are known, guessing at
 * column layouts would risk silently mis-mapping real financial data —
 * worse than not having the adapter at all. Each is registered with a
 * `detect` that never matches (so it can never mis-fire) and a `parse`
 * that throws; the corresponding test files are `it.skip`, named after
 * the exact fixture file each one is blocked on.
 */
export type NamedImportAdapterId = "moneybird" | "declair" | "eboekhouden";

export interface NamedImportAdapter {
  id: NamedImportAdapterId;
  label: string;
  blockedOn: string;
  detect: (headerRow: string[]) => boolean;
  parse: (headerRow: string[], rows: string[][]) => never;
}

function notImplemented(
  adapter: NamedImportAdapterId,
  fixturePath: string,
): NamedImportAdapter["parse"] {
  return () => {
    throw new Error(
      `${adapter} import adapter is not implemented — blocked on a real sample export at ${fixturePath}`,
    );
  };
}

export const NAMED_IMPORT_ADAPTERS: NamedImportAdapter[] = [
  {
    id: "moneybird",
    label: "Moneybird",
    blockedOn: "docs/import-formats/moneybird-sample.csv",
    detect: () => false,
    parse: notImplemented("moneybird", "docs/import-formats/moneybird-sample.csv"),
  },
  {
    id: "declair",
    label: "Declair",
    blockedOn: "docs/import-formats/declair-sample.csv",
    detect: () => false,
    parse: notImplemented("declair", "docs/import-formats/declair-sample.csv"),
  },
  {
    id: "eboekhouden",
    label: "e-Boekhouden",
    blockedOn: "docs/import-formats/eboekhouden-sample.csv",
    detect: () => false,
    parse: notImplemented("eboekhouden", "docs/import-formats/eboekhouden-sample.csv"),
  },
];

/** Returns the first named adapter that recognizes this header row, or null (falls back to the generic manual-mapping path). */
export function detectImportAdapter(headerRow: string[]): NamedImportAdapter | null {
  return NAMED_IMPORT_ADAPTERS.find((adapter) => adapter.detect(headerRow)) ?? null;
}
