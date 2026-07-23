/**
 * Contract types for packages/core/src/tax — the pure engine functions
 * themselves (computeQuarter, korRollingTurnover, computeWaterfall,
 * estimateIncomeTax, splitInvoice, buildDepreciationSchedule,
 * deadlinesForYear) are built in Pillar 2 against these shapes and the Maya
 * golden fixtures. Defining the contract now lets API and web code (Pillar 1
 * routes, Pillar 3+ screens) compile against a stable shape before the
 * engine lands.
 */

export type VatRate = 21 | 9 | 0 | "exempt";

export interface BracketDef {
  /** Upper bound of this bracket in cents; null means "and above" (top bracket). */
  uptoCents: number | null;
  rateBps: number;
}

export interface ArbeidskortingBand {
  fromCents: number;
  toCents: number | null;
  rateBps: number;
}

/**
 * One row per tax year (the RuleCatalog analog). Additive-only: a new tax
 * year is a new row + reviewed PR; historic years never mutate.
 */
export interface TaxFigures {
  year: number;
  brackets: BracketDef[];
  zelfstandigenaftrekCents: number;
  startersaftrekCents: number;
  mkbVrijstellingBps: number;
  zvwBps: number;
  korLimitCents: number;
  algemeneHeffingskortingMaxCents: number;
  arbeidskortingTable: ArbeidskortingBand[];
}

export interface IncomeLineInput {
  amountExVatCents: number;
  vatRate: VatRate;
}

export interface ExpenseLineInput {
  amountExVatCents: number;
  vatRate: VatRate;
  vatReclaimable: boolean;
}

export interface QuarterComputation {
  rubriek1aCents: number;
  rubriek1bCents: number;
  rubriek5bCents: number;
  rubriek5cCents: number;
  perLineVatCents: number[];
}

export interface WaterfallStep {
  label: string;
  amountCents: number;
  runningTotalCents: number;
  eligible: boolean;
  reason?: string;
}

export interface BracketFill {
  bracket: BracketDef;
  filledCents: number;
  taxCents: number;
}

export interface IncomeTaxEstimate {
  bracketFills: BracketFill[];
  zvwCents: number;
  creditsCents: number;
  setAsideCents: number;
}

export interface SetAsideSplit {
  yoursCents: number;
  vatCents: number;
  reserveCents: number;
}

export interface DepreciationYearEntry {
  year: number;
  month: number;
  amountCents: number;
}

export type DeadlineKind = "btw_q" | "income_tax" | "voorlopige_aanslag" | "custom";

export interface DeadlineDef {
  kind: DeadlineKind;
  dueDate: string; // ISO YYYY-MM-DD, Europe/Amsterdam calendar date
  quarter?: 1 | 2 | 3 | 4;
}
