import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { forOrg, type Database } from "@kwartaal/db";
import { newId } from "@kwartaal/core";
import { audit } from "./audit";

/**
 * Runs from Better Auth's user.create.after hook, alongside
 * provisionOrgForNewUser — the two are mutually exclusive (see auth/index.ts).
 * A global scan filtered in JS (not a DB-level query) because email isn't
 * indexed on its own (only the (org_id, email) compound) and this table is
 * small by nature (pending invites, not history); matches the precedent set
 * by provisionOrgForNewUser's own `db.query.users.findFirst` global lookup.
 *
 * Returns true if a pending invite was consumed (the caller must then skip
 * auto-provisioning a new org for this user).
 */
export async function consumeInviteIfPending(
  db: Database,
  authUserId: string,
  email: string,
): Promise<boolean> {
  const now = new Date();
  const rows = await db.select().from(schema.invites);
  const invite = rows.find(
    (r) => r.email.toLowerCase() === email.toLowerCase() && r.expiresAt > now,
  );
  if (!invite) return false;

  const tenantDb = forOrg(db, invite.orgId);
  await tenantDb.insert(schema.users, {
    id: newId("user"),
    authUserId,
    role: invite.role,
    status: "active",
  });
  await tenantDb.delete(schema.invites, eq(schema.invites.id, invite.id));
  await audit(tenantDb, {
    actor: invite.invitedBy,
    action: "invite.accepted",
    target: invite.id,
    meta: { email: invite.email },
  });

  return true;
}
