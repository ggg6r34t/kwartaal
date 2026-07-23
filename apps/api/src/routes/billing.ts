import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { authUser } from "@kwartaal/db/auth-schema";
import {
  type BillingStatusResponse,
  type CheckoutSessionResponse,
  createCheckoutSessionRequestSchema,
  type PortalSessionResponse,
} from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";
import { computeEntitlement } from "../lib/entitlement";
import { subscriptionDto } from "../lib/dto-billing";
import { BillingNotConfiguredError, getStripeClient } from "../lib/stripe";

export const billing = new Hono<AppEnv>();

billing.get("/status", async (c) => {
  const tenantDb = c.get("tenantDb");
  const [profile] = await tenantDb.select(schema.businessProfiles);
  const [sub] = await tenantDb.select(schema.subscriptions);
  const hasProAccess = await computeEntitlement(tenantDb);

  const response: BillingStatusResponse = {
    hasProAccess,
    firstQuarterClosedAt: profile?.firstQuarterClosedAt
      ? profile.firstQuarterClosedAt.getTime()
      : null,
    subscription: sub ? subscriptionDto(sub) : null,
  };
  return c.json(response);
});

/**
 * Creates (or reuses) the org's Stripe Customer, then a Checkout Session for
 * the requested price. `client_reference_id` + `metadata.orgId` both carry
 * the org id through to the webhook, since a session and its resulting
 * subscription are two separate webhook events.
 */
billing.post(
  "/checkout-session",
  requireRole("owner"),
  zValidator("json", createCheckoutSessionRequestSchema),
  async (c) => {
    let stripe;
    try {
      stripe = getStripeClient(c.env);
    } catch (err) {
      if (err instanceof BillingNotConfiguredError) {
        return c.json({ error: "billing-not-configured" }, 503);
      }
      throw err;
    }

    const tenantDb = c.get("tenantDb");
    const body = c.req.valid("json");
    const priceId =
      body.interval === "annual" ? c.env.STRIPE_PRICE_ANNUAL : c.env.STRIPE_PRICE_MONTHLY;

    const [existingSub] = await tenantDb.select(schema.subscriptions);
    let customerId = existingSub?.stripeCustomerId;

    if (!customerId) {
      const [membership] = await tenantDb.select(
        schema.users,
        eq(schema.users.id, c.get("session").userId),
      );
      const [authRow] = await tenantDb.global
        .select({ email: authUser.email })
        .from(authUser)
        .where(eq(authUser.id, membership!.authUserId));

      const customer = await stripe.customers.create({
        email: authRow?.email,
        metadata: { orgId: tenantDb.orgId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: tenantDb.orgId,
      subscription_data: { metadata: { orgId: tenantDb.orgId } },
      success_url: `${c.env.APP_ORIGIN}/app/settings?billing=success`,
      cancel_url: `${c.env.APP_ORIGIN}/app/settings?billing=cancelled`,
      // Locked decision #5: "we dogfood the same EU VAT machinery we
      // explain." Stripe Tax needs a customer location, hence requiring
      // the address Checkout collects (the Customer above is created with
      // none) and letting it write that address back onto the Customer.
      // tax_id_collection lets a ZZP'er enter their own btw-id for
      // reverse-charge, same as any other EU B2B Stripe purchase.
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
    });

    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "billing.checkout-session-created",
      meta: { interval: body.interval },
    });

    if (!session.url) return c.json({ error: "checkout-session-failed" }, 502);
    const response: CheckoutSessionResponse = { url: session.url };
    return c.json(response);
  },
);

billing.post("/portal-session", requireRole("owner"), async (c) => {
  let stripe;
  try {
    stripe = getStripeClient(c.env);
  } catch (err) {
    if (err instanceof BillingNotConfiguredError) {
      return c.json({ error: "billing-not-configured" }, 503);
    }
    throw err;
  }

  const tenantDb = c.get("tenantDb");
  const [sub] = await tenantDb.select(schema.subscriptions);
  if (!sub) return c.json({ error: "no-subscription" }, 404);

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${c.env.APP_ORIGIN}/app/settings`,
  });

  const response: PortalSessionResponse = { url: portal.url };
  return c.json(response);
});
