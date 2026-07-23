import { z } from "zod";
import {
  centsSchema,
  importAdapterSchema,
  isoDateSchema,
  lineSourceSchema,
  vatRateSchema,
} from "./common";

export const incomeLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  quarterId: z.string(),
  date: isoDateSchema,
  description: z.string().min(1),
  amountExVatCents: centsSchema,
  vatRate: vatRateSchema,
  vatCents: centsSchema,
  source: lineSourceSchema,
  importSource: importAdapterSchema.nullable(),
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

/** Manual-entry payload — quarterId comes from the route, vatCents is engine-computed, source/importSource are set by the server. */
export const createIncomeLineSchema = incomeLineSchema.omit({
  id: true,
  orgId: true,
  quarterId: true,
  vatCents: true,
  source: true,
  importSource: true,
});
export type CreateIncomeLine = z.infer<typeof createIncomeLineSchema>;

export const createExpenseLineSchema = expenseLineSchema.omit({
  id: true,
  orgId: true,
  quarterId: true,
  vatCents: true,
  receiptId: true,
});
export type CreateExpenseLine = z.infer<typeof createExpenseLineSchema>;
