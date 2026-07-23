import type { ExpenseLineInput, IncomeLineInput, QuarterComputation } from "./types";
import { vatCentsForRate } from "./rounding";

/**
 * rubriek 1a = general-rate (21%) supplies, 1b = reduced-rate (9%) supplies.
 * 0% and exempt lines contribute zero VAT to either (exempt also never
 * contributes voorbelasting on the expense side — it isn't a rate to
 * reclaim against, it's an absence of VAT entirely). rubriek 5c is what's
 * actually owed: 1a + 1b − 5b.
 */
export function computeQuarter(
  incomeLines: IncomeLineInput[],
  expenseLines: ExpenseLineInput[],
): QuarterComputation {
  let rubriek1aCents = 0;
  let rubriek1bCents = 0;
  const perLineVatCents: number[] = [];

  for (const line of incomeLines) {
    const vat =
      line.vatRate === "exempt" || line.vatRate === 0
        ? 0
        : vatCentsForRate(line.amountExVatCents, line.vatRate);
    perLineVatCents.push(vat);
    if (line.vatRate === 21) rubriek1aCents += vat;
    else if (line.vatRate === 9) rubriek1bCents += vat;
  }

  let rubriek5bCents = 0;
  for (const line of expenseLines) {
    if (!line.vatReclaimable || line.vatRate === "exempt" || line.vatRate === 0) continue;
    rubriek5bCents += vatCentsForRate(line.amountExVatCents, line.vatRate);
  }

  const rubriek5cCents = rubriek1aCents + rubriek1bCents - rubriek5bCents;

  return {
    rubriek1aCents,
    rubriek1bCents,
    rubriek5bCents,
    rubriek5cCents,
    perLineVatCents,
  };
}
