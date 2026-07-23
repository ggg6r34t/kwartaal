import { z } from "zod";
import { centsSchema } from "./common";

const waterfallStepSchema = z.object({
  label: z.string(),
  amountCents: centsSchema,
  runningTotalCents: centsSchema,
  eligible: z.boolean(),
  reason: z.string().optional(),
});

const bracketFillSchema = z.object({
  uptoCents: centsSchema.nullable(),
  rateBps: z.number().int(),
  filledCents: centsSchema,
  taxCents: centsSchema,
});

/**
 * `figuresPending: true` means the year's TaxFigures row isn't seeded yet —
 * every field below `hoursTarget` is null in that case (never a silently
 * reused prior year's numbers; the annual studio shows the "figures
 * pending" state instead). Calendar/btw data (revenue, costs, hours) is
 * still real and populated regardless — those never depended on the
 * registry.
 */
export const incomeTaxStudioResponseSchema = z.object({
  year: z.number().int(),
  figuresPending: z.boolean(),
  revenueCents: centsSchema,
  costsCents: centsSchema,
  profitCents: centsSchema,
  hoursLogged: z.number().int(),
  hoursTarget: z.number().int(),
  meetsUrencriterium: z.boolean(),
  startersaftrekUsedCount: z.number().int(),
  waterfall: z.array(waterfallStepSchema).nullable(),
  taxableCents: centsSchema.nullable(),
  bracketFills: z.array(bracketFillSchema).nullable(),
  zvwCents: centsSchema.nullable(),
  creditsCents: centsSchema.nullable(),
  setAsideCents: centsSchema.nullable(),
});
export type IncomeTaxStudioResponse = z.infer<typeof incomeTaxStudioResponseSchema>;
