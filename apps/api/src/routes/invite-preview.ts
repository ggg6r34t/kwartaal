import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import type { AppEnv } from "../bindings";

export const invitePreview = new Hono<AppEnv>();

/**
 * Public (no session — the invitee isn't authenticated yet) lookup for the
 * AcceptInvite landing page's "you're invited to <org>" framing. Returns
 * only what's safe to show before sign-in: org name and the invited email,
 * never the invite id or anything else.
 */
invitePreview.get("/:token", async (c) => {
  const token = c.req.param("token");
  const db = c.get("db");

  const [invite] = await db
    .select()
    .from(schema.invites)
    .where(eq(schema.invites.token, token));
  if (!invite || invite.expiresAt < new Date()) {
    return c.json({ error: "invite-not-found" }, 404);
  }

  const [org] = await db
    .select()
    .from(schema.orgs)
    .where(eq(schema.orgs.id, invite.orgId));

  return c.json({ orgName: org?.name ?? "Kwartaal", email: invite.email });
});
