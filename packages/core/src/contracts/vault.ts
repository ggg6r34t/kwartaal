import { z } from "zod";
import { centsSchema, isoDateSchema } from "./common";

export const hoursEntrySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: isoDateSchema,
  hours: z.number().int().min(0).max(24),
  note: z.string().nullable(),
});
export type HoursEntry = z.infer<typeof hoursEntrySchema>;
export const createHoursEntrySchema = hoursEntrySchema.omit({ id: true, orgId: true });

export const kmEntrySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: isoDateSchema,
  km: z.number().int().min(0),
  purpose: z.string().nullable(),
});
export type KmEntry = z.infer<typeof kmEntrySchema>;
export const createKmEntrySchema = kmEntrySchema.omit({ id: true, orgId: true });

export const potSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string().min(1),
  targetCents: centsSchema,
  currentCents: centsSchema,
  kind: z.enum(["business", "private"]),
});
export type Pot = z.infer<typeof potSchema>;
export const createPotSchema = potSchema.omit({
  id: true,
  orgId: true,
  currentCents: true,
});
export const updatePotSchema = z.object({ currentCents: centsSchema });

export const setAsideEntryStatusSchema = z.enum(["pending", "confirmed"]);
export type SetAsideEntryStatus = z.infer<typeof setAsideEntryStatusSchema>;

export const setAsideEntrySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  invoiceRef: z.string().min(1),
  totalCents: centsSchema,
  vatCents: centsSchema,
  reserveCents: centsSchema,
  rateBps: z.number().int(),
  status: setAsideEntryStatusSchema,
});
export type SetAsideEntry = z.infer<typeof setAsideEntrySchema>;
export const createSetAsideEntrySchema = z.object({
  invoiceRef: z.string().min(1),
  totalCents: centsSchema.positive(),
  vatRate: z.union([z.literal(21), z.literal(9), z.literal(0)]),
  reserveRateBps: z.number().int().min(0).max(10000),
  // "I moved it — done" -> confirmed (default); "Remind me tonight" ->
  // pending, pinning this entry to Today until confirmed.
  status: setAsideEntryStatusSchema.default("confirmed"),
});

/** Resolves a pinned-to-Today entry once the user confirms the money actually moved. */
export const confirmSetAsideEntrySchema = z.object({ status: z.literal("confirmed") });

export const voorlopigeAanslagSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  year: z.number().int(),
  monthlyCents: centsSchema,
  startMonth: z.number().int().min(1).max(12),
  active: z.boolean(),
});
export type VoorlopigeAanslag = z.infer<typeof voorlopigeAanslagSchema>;
export const upsertVoorlopigeAanslagSchema = voorlopigeAanslagSchema.omit({
  id: true,
  orgId: true,
});

const checklistElementSchema = z.object({ confirmed: z.boolean() });
export const RECEIPT_CHECKLIST_ELEMENTS = [
  "date",
  "supplierDetails",
  "vatNumber",
  "description",
  "amountExVat",
  "vatAmount",
] as const;
export type ReceiptChecklistElement = (typeof RECEIPT_CHECKLIST_ELEMENTS)[number];

/** Over this, a missing element can no longer just sit unconfirmed — it needs a full receipt or a note. */
export const RECEIPT_NOTE_FALLBACK_THRESHOLD_CENTS = 10000;

export const receiptSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  r2Key: z.string(),
  capturedAt: z.number().int(),
  checklist: z.record(z.string(), checklistElementSchema).nullable(),
  missingCount: z.number().int(),
  amountCents: centsSchema.nullable(),
  note: z.string().nullable(),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const updateReceiptChecklistSchema = z.object({
  checklist: z.record(z.enum(RECEIPT_CHECKLIST_ELEMENTS), checklistElementSchema),
});

/** The note-fallback rule: save despite a missing element by recording why, alongside the photo. Amount is set here too — receipts have no OCR (locked decision #9), so it's typed in on review, not detected. */
export const updateReceiptDetailsSchema = z.object({
  amountCents: centsSchema.optional(),
  note: z.string().min(1).max(500).optional(),
});

export const exportJobSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  kind: z.enum(["data", "bookkeeper_summary"]),
  year: z.number().int().nullable(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  r2Key: z.string().nullable(),
  requestedBy: z.string(),
});
export type ExportJob = z.infer<typeof exportJobSchema>;

export const createExportJobSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("data") }),
  z.object({ kind: z.literal("bookkeeper_summary"), year: z.number().int() }),
]);
export type CreateExportJob = z.infer<typeof createExportJobSchema>;
