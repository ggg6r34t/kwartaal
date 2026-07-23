import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import type { Database } from "@kwartaal/db";
import { newId } from "@kwartaal/core";

/**
 * Runs on Better Auth's user.create.after hook (see auth/index.ts). Kwartaal
 * inverts the blueprint's closed-signup + out-of-band bootstrap: signup is
 * open, so the org + BusinessProfile shell is created automatically the
 * moment a new authUser row exists, with that user as Owner.
 */
export async function provisionOrgForNewUser(
  db: Database,
  authUserId: string,
): Promise<void> {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.authUserId, authUserId),
  });
  if (existing) return; // idempotent: never double-provision

  const orgId = newId("org");
  const userId = newId("user");
  const businessProfileId = newId("businessProfile");
  const now = new Date();

  await db.insert(schema.orgs).values({
    id: orgId,
    name: "My business",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.users).values({
    id: userId,
    orgId,
    authUserId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.businessProfiles).values({
    id: businessProfileId,
    orgId,
    legalForm: "eenmanszaak",
    kvkRegisteredAt: null,
    korOptIn: false,
    korSince: null,
    hasSalariedJob: false,
    startersaftrekUsedCount: 0,
    defaultSetAsideRateBps: 3000,
    firstQuarterClosedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}
