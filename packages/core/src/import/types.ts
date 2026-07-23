import type { VatRate } from "../tax/types";

export interface ImportRowError {
  rowIndex: number; // 0-indexed into the data rows (header excluded)
  message: string;
}

export interface ParsedIncomeLine {
  date: string;
  description: string;
  amountExVatCents: number;
  vatRate: VatRate;
}

export interface ParsedExpenseLine {
  date: string;
  supplier: string;
  amountExVatCents: number;
  vatRate: VatRate;
  vatReclaimable: boolean;
}

export interface ImportResult<T> {
  lines: T[];
  errors: ImportRowError[];
}

/** Column indices into a CSV row, chosen by the user in the manual column-mapping step. */
export interface GenericCsvMapping {
  date: number;
  /** Description for income lines, supplier for expense lines. */
  label: number;
  amountExVatCents: number;
  vatRate: number;
}
