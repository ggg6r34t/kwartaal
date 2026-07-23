/**
 * Money is integer cents end to end (blueprint §6 basis-points convention,
 * applied as cents for this domain). Dutch number formatting throughout;
 * inputs tolerate both comma and period decimal separators.
 */
const NL_CURRENCY = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatCents(cents: number): string {
  return NL_CURRENCY.format(cents / 100);
}

/**
 * Parses a user-typed amount in either Dutch (1.234,56) or plain (1234.56 /
 * 1234,56) notation into integer cents. The last "," or "." in the string is
 * treated as the decimal separator; the other character is treated as a
 * thousands separator and stripped.
 */
export function parseAmountToCents(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("amount is empty");
  }

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  let normalized: string;
  if (lastComma > lastDot) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = trimmed.replace(/,/g, "");
  } else {
    normalized = trimmed;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`invalid amount: ${input}`);
  }
  return Math.round(value * 100);
}
