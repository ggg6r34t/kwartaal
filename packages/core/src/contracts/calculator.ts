import { z } from "zod";
import { centsSchema } from "./common";

export const setAsideCalculatorRequestSchema = z.object({
  totalCents: centsSchema.positive(),
  vatRate: z.union([z.literal(21), z.literal(9), z.literal(0)]),
  reserveRateBps: z.number().int().min(0).max(10000),
});
export type SetAsideCalculatorRequest = z.infer<typeof setAsideCalculatorRequestSchema>;

export const setAsideCalculatorResponseSchema = z.object({
  yoursCents: centsSchema,
  vatCents: centsSchema,
  reserveCents: centsSchema,
});
export type SetAsideCalculatorResponse = z.infer<typeof setAsideCalculatorResponseSchema>;
