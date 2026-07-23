/**
 * Belastingdienst rounding convention (documented in docs/rounding.md):
 * half rounds up (commercial rounding), applied at the smallest unit that
 * actually appears on a form or invoice line — never on an un-rounded
 * running total. See docs/rounding.md for the full rationale.
 */
export function roundHalfUp(value: number): number {
  return Math.round(value);
}

/** VAT for one line, rounded per docs/rounding.md. 0% and exempt both contribute zero (handled by callers before invoking this for non-percentage rates). */
export function vatCentsForRate(
  amountExVatCents: number,
  ratePercent: 21 | 9 | 0,
): number {
  if (ratePercent === 0) return 0;
  return roundHalfUp((amountExVatCents * ratePercent) / 100);
}

/** Applies a basis-points rate to a cents amount, rounded per docs/rounding.md. */
export function bpsOfCents(amountCents: number, rateBps: number): number {
  return roundHalfUp((amountCents * rateBps) / 10000);
}
