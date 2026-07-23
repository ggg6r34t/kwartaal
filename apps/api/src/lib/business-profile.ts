import { schema } from "@kwartaal/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type { BusinessProfile } from "@kwartaal/core";

type BusinessProfileRow = InferSelectModel<typeof schema.businessProfiles>;

export function toBusinessProfileDto(row: BusinessProfileRow): BusinessProfile {
  return {
    id: row.id,
    orgId: row.orgId,
    legalForm: row.legalForm as BusinessProfile["legalForm"],
    kvkRegisteredAt: row.kvkRegisteredAt,
    korOptIn: row.korOptIn,
    korSince: row.korSince,
    hasSalariedJob: row.hasSalariedJob,
    startersaftrekUsedCount: row.startersaftrekUsedCount,
    defaultSetAsideRateBps: row.defaultSetAsideRateBps,
    reminderCadence: row.reminderCadence as BusinessProfile["reminderCadence"],
    onboardedAt: row.onboardedAt ? row.onboardedAt.getTime() : null,
    firstQuarterClosedAt: row.firstQuarterClosedAt
      ? row.firstQuarterClosedAt.getTime()
      : null,
  };
}
