import type {
  ArbeidskortingBand,
  BracketFill,
  IncomeTaxEstimate,
  TaxFigures,
} from "./types";
import { bpsOfCents } from "./rounding";

function fillBrackets(
  taxableCents: number,
  figures: TaxFigures,
): { fills: BracketFill[]; taxCents: number } {
  const fills: BracketFill[] = [];
  let remaining = Math.max(taxableCents, 0);
  let previousUpto = 0;
  let taxCents = 0;

  for (const bracket of figures.brackets) {
    const bracketSize =
      bracket.uptoCents === null
        ? remaining
        : Math.max(bracket.uptoCents - previousUpto, 0);
    const filledCents = Math.min(remaining, bracketSize);
    const bracketTaxCents = bpsOfCents(filledCents, bracket.rateBps);
    fills.push({ bracket, filledCents, taxCents: bracketTaxCents });
    taxCents += bracketTaxCents;
    remaining -= filledCents;
    if (bracket.uptoCents !== null) previousUpto = bracket.uptoCents;
  }

  return { fills, taxCents };
}

function bandedCredit(baseCents: number, table: ArbeidskortingBand[]): number {
  let credit = 0;
  for (const band of table) {
    const bandTop = band.toCents === null ? baseCents : Math.min(baseCents, band.toCents);
    const bandSize = Math.max(bandTop - band.fromCents, 0);
    credit += bpsOfCents(bandSize, band.rateBps);
  }
  return Math.max(credit, 0);
}

/**
 * taxable -> per-bracket fill (the vessels visual renders `bracketFills`
 * directly) -> Zvw -> credits -> one setAsideCents total. `payrollWithheldCents`
 * lets a future salaried-job merge view reduce what still needs setting
 * aside, without changing this function's signature (locked decision — the
 * merge view is v1-invisible but the engine already accepts the input).
 *
 * Zvw/heffingskorting/arbeidskorting figures are 2025-based placeholders
 * (see docs/tax-figures.md once Pillar 6 writes it, and PROGRESS.md
 * Pillar 1 deviation #1) — no golden fixture in the plan pins an exact
 * setAsideCents value, so this function is tested for shape and
 * non-negativity, not an exact number.
 */
export function estimateIncomeTax(
  taxableCents: number,
  figures: TaxFigures,
  payrollWithheldCents = 0,
): IncomeTaxEstimate {
  const { fills, taxCents } = fillBrackets(taxableCents, figures);
  const zvwCents = bpsOfCents(Math.max(taxableCents, 0), figures.zvwBps);
  const creditsCents =
    figures.algemeneHeffingskortingMaxCents +
    bandedCredit(Math.max(taxableCents, 0), figures.arbeidskortingTable);
  const setAsideCents = Math.max(
    taxCents + zvwCents - creditsCents - payrollWithheldCents,
    0,
  );

  return { bracketFills: fills, zvwCents, creditsCents, setAsideCents };
}
