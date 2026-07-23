import { z } from "zod";
import { centsSchema, isoDateSchema, quarterStatusSchema } from "./common";

export const quarterSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  year: z.number().int(),
  q: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  status: quarterStatusSchema,
  filedAt: isoDateSchema.nullable(),
  paidAt: isoDateSchema.nullable(),
  rubriek1aCents: centsSchema.nullable(),
  rubriek1bCents: centsSchema.nullable(),
  rubriek5bCents: centsSchema.nullable(),
  rubriek5cCents: centsSchema.nullable(),
});
export type Quarter = z.infer<typeof quarterSchema>;
