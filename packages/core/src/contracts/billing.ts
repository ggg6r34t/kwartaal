import { z } from "zod";

export const billingIntervalSchema = z.enum(["monthly", "annual"]);
export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const createCheckoutSessionRequestSchema = z.object({
  interval: billingIntervalSchema,
});
export type CreateCheckoutSessionRequest = z.infer<
  typeof createCheckoutSessionRequestSchema
>;

export const checkoutSessionResponseSchema = z.object({ url: z.string() });
export type CheckoutSessionResponse = z.infer<typeof checkoutSessionResponseSchema>;

export const portalSessionResponseSchema = z.object({ url: z.string() });
export type PortalSessionResponse = z.infer<typeof portalSessionResponseSchema>;

export const subscriptionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  plan: z.enum(["free", "pro"]),
  status: z.string(),
  currentPeriodEnd: z.number().int().nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const billingStatusResponseSchema = z.object({
  hasProAccess: z.boolean(),
  /** null when the trial hasn't closed yet — the reason hasProAccess can still be true with no subscription. */
  firstQuarterClosedAt: z.number().int().nullable(),
  subscription: subscriptionSchema.nullable(),
});
export type BillingStatusResponse = z.infer<typeof billingStatusResponseSchema>;
