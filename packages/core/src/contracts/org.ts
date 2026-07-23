import { z } from "zod";
import { legalFormSchema, isoDateSchema, roleSchema } from "./common";

export const orgSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.number().int(),
});
export type Org = z.infer<typeof orgSchema>;

export const reminderCadenceSchema = z.enum(["calm", "persistent"]);
export type ReminderCadence = z.infer<typeof reminderCadenceSchema>;

export const businessProfileSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  legalForm: legalFormSchema,
  kvkRegisteredAt: isoDateSchema.nullable(),
  korOptIn: z.boolean(),
  korSince: isoDateSchema.nullable(),
  hasSalariedJob: z.boolean(),
  startersaftrekUsedCount: z.number().int().min(0).max(3),
  defaultSetAsideRateBps: z.number().int().min(0).max(10000),
  reminderCadence: reminderCadenceSchema,
  onboardedAt: z.number().int().nullable(),
  firstQuarterClosedAt: z.number().int().nullable(),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const meResponseSchema = z.object({
  org: orgSchema,
  role: roleSchema,
  businessProfile: businessProfileSchema.nullable(),
  /** Computed server-side via hasProAccess — the frontend never re-derives entitlement itself. */
  hasProAccess: z.boolean(),
  deletionRequestedAt: z.number().int().nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
