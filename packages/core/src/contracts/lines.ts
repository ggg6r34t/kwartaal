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

export const createExpenseLineSchema = expenseLineSchema
  .omit({
    id: true,
    orgId: true,
    quarterId: true,
    vatCents: true,
    receiptId: true,
  })
  .extend({
    /** Required (and only meaningful) when deductionMode is "depreciate" — builds the DepreciationSchedule row via the same buildDepreciationSchedule the engine golden-tests. */
    depreciation: z
      .object({
        years: z.number().int().min(1).max(50),
        residualCents: centsSchema.min(0),
        startMonth: z.number().int().min(1).max(12),
      })
      .optional(),
  });
export type CreateExpenseLine = z.infer<typeof createExpenseLineSchema>;

export const depreciationScheduleEntrySchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  amountCents: centsSchema,
});
export type DepreciationScheduleEntryDto = z.infer<
  typeof depreciationScheduleEntrySchema
>;

/** Vault's start-up costs corner: an expense line plus, when depreciated, its full year-by-year schedule. */
export const startupCostSchema = z.object({
  line: expenseLineSchema,
  depreciation: z
    .object({
      years: z.number().int(),
      residualCents: centsSchema,
      startMonth: z.number().int(),
      schedule: z.array(depreciationScheduleEntrySchema),
    })
    .nullable(),
});
export type StartupCost = z.infer<typeof startupCostSchema>;
