import { Hono } from "hono";
import Stripe from "stripe";
import type { AppEnv } from "../bindings";
import { logger } from "../lib/logger";
import { processStripeEvent } from "../lib/stripe-webhook";

export const billingWebhook = new Hono<AppEnv>();

/**
 * Signature-verified, idempotent (see lib/stripe-webhook.ts's
 * webhook_events insert-before-process — same pattern as reminder_logs).
 * No session exists for a webhook call, so this route never touches
 * tenantDb/csrfGuard/requireSession — see index.ts's mount.
 */
billingWebhook.post("/", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "billing-not-configured" }, 503);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) return c.json({ error: "missing-signature" }, 400);

  const payload = await c.req.text();

  let event: Stripe.Event;
  try {
    event = await Stripe.webhooks.constructEventAsync(
      payload,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    logger.error("stripe-webhook-signature-invalid", {
      message: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "invalid-signature" }, 400);
  }

  await processStripeEvent(c.env, event);

  return c.json({ received: true });
});
