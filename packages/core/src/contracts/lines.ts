import { z } from "zod";
import { centsSchema, importSourceSchema, isoDateSchema, vatRateSchema } from "./common";

export const incomeLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  quarterId: z.string(),
  date: isoDateSchema,
  description: z.string().min(1),
  amountExVatCents: centsSchema,
  vatRate: vatRateSchema,
  vatCents: centsSchema,
  source: importSourceSchema,
});
export type IncomeLine = z.infer<typeof incomeLineSchema>;

export const expenseLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  quarterId: z.string(),
  date: isoDateSchema,
  supplier: z.string().min(1),
  amountExVatCents: centsSchema,
  vatRate: vatRateSchema,
  vatCents: centsSchema,
  vatReclaimable: z.boolean(),
  isStartupCost: z.boolean(),
  deductionMode: z.enum(["expense", "depreciate"]),
  receiptId: z.string().nullable(),
});
export type ExpenseLine = z.infer<typeof expenseLineSchema>;

export const createIncomeLineSchema = incomeLineSchema.omit({
  id: true,
  orgId: true,
  vatCents: true,
});

export const createExpenseLineSchema = expenseLineSchema.omit({
  id: true,
  orgId: true,
  vatCents: true,
});
