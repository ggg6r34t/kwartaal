import { parseAmountToCents } from "../money";
import type { VatRate } from "../tax/types";
import type {
  GenericCsvMapping,
  ImportResult,
  ImportRowError,
  ParsedExpenseLine,
  ParsedIncomeLine,
} from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseVatRateCell(raw: string): VatRate | null {
  const trimmed = raw.trim().toLowerCase().replace("%", "");
  if (trimmed === "exempt" || trimmed === "vrijgesteld") return "exempt";
  if (trimmed === "21") return 21;
  if (trimmed === "9") return 9;
  if (trimmed === "0") return 0;
  return null;
}

function parseDateCell(raw: string): string | null {
  const trimmed = raw.trim();
  return DATE_PATTERN.test(trimmed) ? trimmed : null;
}

function parseAmountCell(raw: string): number | null {
  try {
    return parseAmountToCents(raw ?? "");
  } catch {
    return null;
  }
}

/**
 * The generic CSV path: no header-signature detection, the user maps
 * columns by hand. Every row is validated; if ANY row fails, nothing is
 * returned as importable (the atomic "never a partial silent import" rule)
 * — `errors` carries every row-level problem so the UI can show exactly
 * what to fix, without needing a second round trip to find the next one.
 */
export function parseGenericIncomeCsv(
  rows: string[][],
  mapping: GenericCsvMapping,
): ImportResult<ParsedIncomeLine> {
  const lines: ParsedIncomeLine[] = [];
  const errors: ImportRowError[] = [];

  rows.forEach((row, rowIndex) => {
    const date = parseDateCell(row[mapping.date] ?? "");
    const description = (row[mapping.label] ?? "").trim();
    const vatRate = parseVatRateCell(row[mapping.vatRate] ?? "");
    const amountExVatCents = parseAmountCell(row[mapping.amountExVatCents] ?? "");

    if (!date)
      errors.push({ rowIndex, message: `invalid date: "${row[mapping.date] ?? ""}"` });
    if (!description) errors.push({ rowIndex, message: "description is empty" });
    if (vatRate === null)
      errors.push({
        rowIndex,
        message: `invalid VAT rate: "${row[mapping.vatRate] ?? ""}"`,
      });
    if (amountExVatCents === null)
      errors.push({
        rowIndex,
        message: `invalid amount: "${row[mapping.amountExVatCents] ?? ""}"`,
      });

    if (date && description && vatRate !== null && amountExVatCents !== null) {
      lines.push({ date, description, amountExVatCents, vatRate });
    }
  });

  return { lines: errors.length === 0 ? lines : [], errors };
}

export function parseGenericExpenseCsv(
  rows: string[][],
  mapping: GenericCsvMapping,
): ImportResult<ParsedExpenseLine> {
  const lines: ParsedExpenseLine[] = [];
  const errors: ImportRowError[] = [];

  rows.forEach((row, rowIndex) => {
    const date = parseDateCell(row[mapping.date] ?? "");
    const supplier = (row[mapping.label] ?? "").trim();
    const vatRate = parseVatRateCell(row[mapping.vatRate] ?? "");
    const amountExVatCents = parseAmountCell(row[mapping.amountExVatCents] ?? "");

    if (!date)
      errors.push({ rowIndex, message: `invalid date: "${row[mapping.date] ?? ""}"` });
    if (!supplier) errors.push({ rowIndex, message: "supplier is empty" });
    if (vatRate === null)
      errors.push({
        rowIndex,
        message: `invalid VAT rate: "${row[mapping.vatRate] ?? ""}"`,
      });
    if (amountExVatCents === null)
      errors.push({
        rowIndex,
        message: `invalid amount: "${row[mapping.amountExVatCents] ?? ""}"`,
      });

    if (date && supplier && vatRate !== null && amountExVatCents !== null) {
      // Reclaimable follows the rate: 0%/exempt purchases have no VAT to
      // reclaim regardless of this flag (computeQuarter already gates on
      // rate too) — no separate mapped column needed for the generic path.
      lines.push({
        date,
        supplier,
        amountExVatCents,
        vatRate,
        vatReclaimable: vatRate === 21 || vatRate === 9,
      });
    }
  });

  return { lines: errors.length === 0 ? lines : [], errors };
}
