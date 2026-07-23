import { hasProAccess } from "@kwartaal/core";
import { schema } from "@kwartaal/db/schema";
import type { TenantDb } from "@kwartaal/db";

/** Stripe subscription statuses that count as "actively paying" for gate purposes. */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * The one place `hasProAccess` gets its inputs from real rows — every
 * caller (GET /orgs/me, onboarding's response, requireProForMutations)
 * goes through this so the gate can never compute differently in two
 * places.
 */
export async function computeEntitlement(tenantDb: TenantDb): Promise<boolean> {
  const [profile] = await tenantDb.select(schema.businessProfiles);
  const [subscription] = await tenantDb.select(schema.subscriptions);

  return hasProAccess({
    activeSubscription: subscription ? ACTIVE_STATUSES.has(subscription.status) : false,
    firstQuarterClosedAt: profile?.firstQuarterClosedAt
      ? profile.firstQuarterClosedAt.toISOString()
      : null,
  });
}
