import type { SetAsideSplit } from "./types";
import { roundHalfUp } from "./rounding";

/**
 * totalCents is what the client actually paid (VAT-inclusive). Splits it
 * into three bands: vat (owed to the Belastingdienst), reserve (the
 * income-tax set-aside, a share of the ex-vat revenue), and yours (the
 * residual). `yours` is deliberately the residual rather than its own
 * independent rounding — see docs/rounding.md — which is what guarantees
 * the three bands always sum to exactly totalCents (a tested property).
 */
export function splitInvoice(
  totalCents: number,
  vatRate: 21 | 9 | 0,
  reserveRateBps: number,
): SetAsideSplit {
  const vatCents =
    vatRate === 0 ? 0 : roundHalfUp((totalCents * vatRate) / (100 + vatRate));
  const exVatCents = totalCents - vatCents;
  const reserveCents = roundHalfUp((exVatCents * reserveRateBps) / 10000);
  const yoursCents = totalCents - vatCents - reserveCents;

  return { yoursCents, vatCents, reserveCents };
}
