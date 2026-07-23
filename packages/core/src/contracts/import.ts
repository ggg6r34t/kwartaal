import { z } from "zod";
import { centsSchema, isoDateSchema, vatRateSchema } from "./common";

const genericCsvMappingSchema = z.object({
  date: z.number().int().min(0),
  label: z.number().int().min(0),
  amountExVatCents: z.number().int().min(0),
  vatRate: z.number().int().min(0),
});

export const importPreviewRequestSchema = z.object({
  lineType: z.enum(["income", "expense"]),
  csvText: z.string().min(1),
  mapping: genericCsvMappingSchema,
  hasHeaderRow: z.boolean(),
});
export type ImportPreviewRequest = z.infer<typeof importPreviewRequestSchema>;

const parsedIncomeLineSchema = z.object({
  date: isoDateSchema,
  description: z.string().min(1),
  amountExVatCents: centsSchema,
  vatRate: vatRateSchema,
});

const parsedExpenseLineSchema = z.object({
  date: isoDateSchema,
  supplier: z.string().min(1),
  amountExVatCents: centsSchema,
  vatRate: vatRateSchema,
  vatReclaimable: z.boolean(),
});

export const importPreviewResponseSchema = z.object({
  lines: z.array(z.union([parsedIncomeLineSchema, parsedExpenseLineSchema])),
  errors: z.array(z.object({ rowIndex: z.number().int(), message: z.string() })),
});
export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;

export const importCommitRequestSchema = z.object({
  lineType: z.enum(["income", "expense"]),
  lines: z.array(z.union([parsedIncomeLineSchema, parsedExpenseLineSchema])).min(1),
});
export type ImportCommitRequest = z.infer<typeof importCommitRequestSchema>;
