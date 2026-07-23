import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { createDb, forOrg } from "@kwartaal/db";
import { schema } from "@kwartaal/db/schema";
import { newId } from "@kwartaal/core";
import type { Bindings } from "../bindings";
import { logger } from "./logger";
import { audit } from "./audit";

/**
 * The DB-touching half of the webhook handler, kept out of routes/** (which
 * the no-raw-database ESLint rule forbids importing createDb into) — mirrors
 * queue.ts living outside routes/ for the same reason. The route itself only
 * does signature verification and idempotency dispatch.
 */
export async function processStripeEvent(
  env: Bindings,
  event: Stripe.Event,
): Promise<void> {
  const db = createDb(env.DB);
  const inserted = await db
    .insert(schema.webhookEvents)
    .values({ id: event.id })
    .onConflictDoNothing()
    .returning({ id: schema.webhookEvents.id });
  if (inserted.length === 0) {
    logger.info("stripe-webhook-already-processed", {
      eventId: event.id,
      type: event.type,
    });
    return;
  }

  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return;
  }

  const subscription = event.data.object;
  const orgId = subscription.metadata?.orgId;
  if (!orgId) {
    logger.error("stripe-webhook-missing-org-metadata", { eventId: event.id });
    return;
  }

  const tenantDb = forOrg(db, orgId);
  const [existing] = await tenantDb.select(schema.subscriptions);
  const currentPeriodEndCents = subscription.items.data[0]?.current_period_end;
  const values = {
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    stripeSubId: subscription.id,
    plan: event.type === "customer.subscription.deleted" ? "free" : "pro",
    status: subscription.status,
    currentPeriodEnd: currentPeriodEndCents
      ? new Date(currentPeriodEndCents * 1000)
      : null,
  } as const;

  if (existing) {
    await tenantDb.update(
      schema.subscriptions,
      values,
      eq(schema.subscriptions.id, existing.id),
    );
  } else {
    await tenantDb.insert(schema.subscriptions, { id: newId("subscription"), ...values });
  }

  // Audit's actor FK requires a real users.id — a webhook has no session, so
  // it attributes the event to the org's owner rather than inventing a
  // "system" actor the FK can't accept.
  const [owner] = await tenantDb.select(schema.users, eq(schema.users.role, "owner"));
  if (owner) {
    await audit(tenantDb, {
      actor: owner.id,
      action: "subscription.updated",
      meta: { status: subscription.status, stripeEventType: event.type },
    });
  }
}
