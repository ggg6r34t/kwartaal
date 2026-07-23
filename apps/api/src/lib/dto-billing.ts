import { schema } from "@kwartaal/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type { Subscription } from "@kwartaal/core";

export function subscriptionDto(
  row: InferSelectModel<typeof schema.subscriptions>,
): Subscription {
  return {
    id: row.id,
    orgId: row.orgId,
    plan: row.plan as Subscription["plan"],
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.getTime() : null,
  };
}
