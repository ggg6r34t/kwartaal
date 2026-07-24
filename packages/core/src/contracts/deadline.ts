import { z } from "zod";
import { isoDateSchema } from "./common";

export const deadlineKindSchema = z.enum([
  "btw_q",
  "income_tax",
  "voorlopige_aanslag",
  "custom",
]);

export const deadlineRowSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  kind: deadlineKindSchema,
  dueDate: isoDateSchema,
  quarterId: z.string().nullable(),
  dismissedAt: z.number().int().nullable(),
  sameDayReminderRequestedAt: z.number().int().nullable(),
});
export type DeadlineRow = z.infer<typeof deadlineRowSchema>;
