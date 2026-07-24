import { schema } from "@kwartaal/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type {
  ExportJob,
  HoursEntry,
  KmEntry,
  Pot,
  Receipt,
  SetAsideEntry,
  VoorlopigeAanslag,
} from "@kwartaal/core";

export function hoursEntryDto(
  row: InferSelectModel<typeof schema.hoursEntries>,
): HoursEntry {
  return {
    id: row.id,
    orgId: row.orgId,
    date: row.date,
    hours: row.hours,
    note: row.note,
  };
}

export function kmEntryDto(row: InferSelectModel<typeof schema.kmEntries>): KmEntry {
  return {
    id: row.id,
    orgId: row.orgId,
    date: row.date,
    km: row.km,
    purpose: row.purpose,
  };
}

export function potDto(row: InferSelectModel<typeof schema.pots>): Pot {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    targetCents: row.targetCents,
    currentCents: row.currentCents,
    kind: row.kind as Pot["kind"],
  };
}

export function setAsideEntryDto(
  row: InferSelectModel<typeof schema.setAsideEntries>,
): SetAsideEntry {
  return {
    id: row.id,
    orgId: row.orgId,
    invoiceRef: row.invoiceRef,
    totalCents: row.totalCents,
    vatCents: row.vatCents,
    reserveCents: row.reserveCents,
    rateBps: row.rateBps,
    status: row.status as SetAsideEntry["status"],
  };
}

export function voorlopigeAanslagDto(
  row: InferSelectModel<typeof schema.voorlopigeAanslagen>,
): VoorlopigeAanslag {
  return {
    id: row.id,
    orgId: row.orgId,
    year: row.year,
    monthlyCents: row.monthlyCents,
    startMonth: row.startMonth,
    active: row.active,
  };
}

export function receiptDto(row: InferSelectModel<typeof schema.receipts>): Receipt {
  return {
    id: row.id,
    orgId: row.orgId,
    r2Key: row.r2Key,
    capturedAt: row.capturedAt.getTime(),
    checklist: row.checklist,
    missingCount: row.missingCount,
    amountCents: row.amountCents,
    note: row.note,
  };
}

export function exportJobDto(row: InferSelectModel<typeof schema.exportJobs>): ExportJob {
  return {
    id: row.id,
    orgId: row.orgId,
    kind: row.kind as ExportJob["kind"],
    year: row.year,
    status: row.status as ExportJob["status"],
    r2Key: row.r2Key,
    requestedBy: row.requestedBy,
  };
}
