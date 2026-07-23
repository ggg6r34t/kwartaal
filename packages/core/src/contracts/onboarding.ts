import { z } from "zod";
import { centsSchema, isoDateSchema, legalFormSchema } from "./common";
import { reminderCadenceSchema } from "./org";

export const onboardingCompleteRequestSchema = z.object({
  legalForm: legalFormSchema,
  kvkRegisteredAt: isoDateSchema.nullable(),
  /** Used only for server-side KOR-eligibility validation — not persisted as its own field. */
  turnoverEstimateCents: centsSchema.min(0),
  korOptIn: z.boolean(),
  defaultSetAsideRateBps: z.number().int().min(2500).max(3500),
  reminderCadence: reminderCadenceSchema,
});
export type OnboardingCompleteRequest = z.infer<typeof onboardingCompleteRequestSchema>;
