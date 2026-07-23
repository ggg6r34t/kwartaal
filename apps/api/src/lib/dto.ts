import { schema } from "@kwartaal/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type { ExpenseLine, IncomeLine, Quarter, VatRate } from "@kwartaal/core";

type QuarterRow = InferSelectModel<typeof schema.quarters>;
type IncomeLineRow = InferSelectModel<typeof schema.incomeLines>;
type ExpenseLineRow = InferSelectModel<typeof schema.expenseLines>;

export function dbVatRateToApi(raw: string): VatRate {
  return raw === "exempt" ? "exempt" : (Number(raw) as 21 | 9 | 0);
}

export function apiVatRateToDb(rate: VatRate): string {
  return String(rate);
}

export function quarterDto(row: QuarterRow): Quarter {
  return {
    id: row.id,
    orgId: row.orgId,
    year: row.year,
    q: row.q as 1 | 2 | 3 | 4,
    status: row.status as Quarter["status"],
    filedAt: row.filedAt ? row.filedAt.getTime() : null,
    paidAt: row.paidAt ? row.paidAt.getTime() : null,
    rubriek1aCents: row.rubriek1aCents,
    rubriek1bCents: row.rubriek1bCents,
    rubriek5bCents: row.rubriek5bCents,
    rubriek5cCents: row.rubriek5cCents,
  };
}

export function incomeLineDto(row: IncomeLineRow): IncomeLine {
  return {
    id: row.id,
    orgId: row.orgId,
    quarterId: row.quarterId,
    date: row.date,
    description: row.description,
    amountExVatCents: row.amountExVatCents,
    vatRate: dbVatRateToApi(row.vatRate),
    vatCents: row.vatCents,
    source: row.source as IncomeLine["source"],
    importSource: row.importSource as IncomeLine["importSource"],
  };
}

export function expenseLineDto(row: ExpenseLineRow): ExpenseLine {
  return {
    id: row.id,
    orgId: row.orgId,
    quarterId: row.quarterId,
    date: row.date,
    supplier: row.supplier,
    amountExVatCents: row.amountExVatCents,
    vatRate: dbVatRateToApi(row.vatRate),
    vatCents: row.vatCents,
    vatReclaimable: row.vatReclaimable,
    isStartupCost: row.isStartupCost,
    deductionMode: row.deductionMode as ExpenseLine["deductionMode"],
    receiptId: row.receiptId,
  };
}
