import { z } from "zod";
import { centsSchema, quarterStatusSchema } from "./common";
import { incomeLineSchema, expenseLineSchema } from "./lines";

export const quarterSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  year: z.number().int(),
  q: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  status: quarterStatusSchema,
  filedAt: z.number().int().nullable(),
  paidAt: z.number().int().nullable(),
  rubriek1aCents: centsSchema.nullable(),
  rubriek1bCents: centsSchema.nullable(),
  rubriek5bCents: centsSchema.nullable(),
  rubriek5cCents: centsSchema.nullable(),
});
export type Quarter = z.infer<typeof quarterSchema>;

export const quarterDetailSchema = quarterSchema.extend({
  incomeLines: z.array(incomeLineSchema),
  expenseLines: z.array(expenseLineSchema),
});
export type QuarterDetail = z.infer<typeof quarterDetailSchema>;

export const fileQuarterResponseSchema = quarterSchema;

export const payQuarterResponseSchema = quarterSchema.extend({
  // Surfaces the trial-closing event to the frontend so it can react (show
  // the paywall interstitial) without a second round-trip.
  firstQuarterJustClosed: z.boolean(),
});
export type PayQuarterResponse = z.infer<typeof payQuarterResponseSchema>;
