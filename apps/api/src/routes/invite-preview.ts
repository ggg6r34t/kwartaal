import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { authUser } from "@kwartaal/db/auth-schema";
import { forOrg } from "@kwartaal/db";
import { newId } from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { audit } from "../lib/audit";

export const invitePreview = new Hono<AppEnv>();

async function findInviteRow(db: AppEnv["Variables"]["db"], token: string) {
  const [invite] = await db
    .select()
    .from(schema.invites)
    .where(eq(schema.invites.token, token));
  return invite ?? null;
}

async function inviterContext(
  db: AppEnv["Variables"]["db"],
  invite: typeof schema.invites.$inferSelect,
) {
  const [org] = await db
    .select()
    .from(schema.orgs)
    .where(eq(schema.orgs.id, invite.orgId));
  const [inviter] = await db
    .select({ name: authUser.name })
    .from(schema.users)
    .innerJoin(authUser, eq(authUser.id, schema.users.authUserId))
    .where(eq(schema.users.id, invite.invitedBy));
  return {
    orgName: org?.name ?? "Kwartaal",
    invitedByName: inviter?.name || org?.name || "Your bookkeeper client",
  };
}

/**
 * Public (no session — the invitee isn't authenticated yet) lookup for the
 * AcceptInvite landing page. Three distinct responses, matching
 * docs/design's Auth surfaces §6: 200 (valid — full preview, everything
 * safe to show before sign-in), 410 (expired — still names who invited
 * them, so "ask Maya to send a fresh one" is possible), 404 (token never
 * existed or was already consumed by an accept/decline — no context to
 * offer, so none is invented).
 */
invitePreview.get("/:token", async (c) => {
  const token = c.req.param("token");
  const db = c.get("db");

  const invite = await findInviteRow(db, token);
  if (!invite) {
    return c.json({ error: "invite-not-found" }, 404);
  }

  const { orgName, invitedByName } = await inviterContext(db, invite);

  if (invite.expiresAt < new Date()) {
    return c.json({ error: "invite-expired", invitedByName }, 410);
  }

  const [profile] = await db
    .select({ legalForm: schema.businessProfiles.legalForm })
    .from(schema.businessProfiles)
    .where(eq(schema.businessProfiles.orgId, invite.orgId));

  return c.json({
    orgName,
    invitedByName,
    legalForm: profile?.legalForm ?? null,
    email: invite.email,
  });
});

/**
 * Declining is as public as previewing — the invitee has no account yet.
 * Deletes the pending invite (so it can never be silently accepted later)
 * and records both an audit-log row and a Notification for the inviting
 * owner (the design's email copy promises "Maya has been notified" — this
 * is that promise, even though there's no notification-inbox UI yet to
 * surface it; the row exists so the claim is true, not decorative).
 */
invitePreview.post("/:token/decline", async (c) => {
  const token = c.req.param("token");
  const db = c.get("db");

  const invite = await findInviteRow(db, token);
  if (!invite || invite.expiresAt < new Date()) {
    return c.json({ error: "invite-not-found" }, 404);
  }

  const tenantDb = forOrg(db, invite.orgId);
  await tenantDb.delete(schema.invites, eq(schema.invites.id, invite.id));
  await tenantDb.insert(schema.notifications, {
    id: newId("notification"),
    kind: "invite_declined",
    message: `${invite.email} declined the bookkeeper invite.`,
  });
  await audit(tenantDb, {
    actor: invite.invitedBy,
    action: "invite.declined",
    target: invite.id,
    meta: { email: invite.email },
  });

  return c.body(null, 204);
});
