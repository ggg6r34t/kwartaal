import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { authUser } from "@kwartaal/db/auth-schema";
import { createInviteRequestSchema, newId, type Invite } from "@kwartaal/core";
import type { AppEnv } from "../bindings";
import { requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";
import { deliverBookkeeperInvite } from "../email/deliver-bookkeeper-invite";

export const invites = new Hono<AppEnv>();

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function inviteDto(row: {
  id: string;
  orgId: string;
  email: string;
  expiresAt: Date;
}): Invite {
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    role: "bookkeeper",
    expiresAt: row.expiresAt.getTime(),
  };
}

invites.get("/", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const rows = await tenantDb.select(schema.invites);
  return c.json(rows.map(inviteDto));
});

invites.post(
  "/",
  requireRole("owner"),
  zValidator("json", createInviteRequestSchema),
  async (c) => {
    const tenantDb = c.get("tenantDb");
    const body = c.req.valid("json");
    const email = body.email.toLowerCase();

    // v1 scope limitation (see PROGRESS.md): users.auth_user_id is unique,
    // so one Better Auth account can only ever belong to one org — an email
    // that already has an account anywhere can't be invited into a second one.
    const [existingAccount] = await tenantDb.global
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, email));
    if (existingAccount) {
      return c.json({ error: "email-already-has-account" }, 409);
    }

    const [org] = await tenantDb.global
      .select()
      .from(schema.orgs)
      .where(eq(schema.orgs.id, tenantDb.orgId));

    const id = newId("invite");
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await tenantDb
      .insert(schema.invites, {
        id,
        email,
        role: "bookkeeper",
        token,
        invitedBy: c.get("session").userId,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [schema.invites.orgId, schema.invites.email],
        set: { token, expiresAt, invitedBy: c.get("session").userId },
      });

    const [row] = await tenantDb.select(schema.invites, eq(schema.invites.email, email));

    await deliverBookkeeperInvite(
      c.env,
      email,
      org?.name ?? "Kwartaal",
      `${c.env.APP_ORIGIN}/accept-invite/${row!.token}`,
    );

    await audit(tenantDb, {
      actor: c.get("session").userId,
      action: "invite.sent",
      target: row!.id,
      meta: { email },
    });

    return c.json(inviteDto(row!), 201);
  },
);

invites.delete("/:id", requireRole("owner"), async (c) => {
  const tenantDb = c.get("tenantDb");
  const id = c.req.param("id");
  await tenantDb.delete(schema.invites, eq(schema.invites.id, id));
  await audit(tenantDb, {
    actor: c.get("session").userId,
    action: "invite.revoked",
    target: id,
  });
  return c.body(null, 204);
});
