import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import { forOrg } from "@kwartaal/db";
import { roleAtLeast, type Role } from "@kwartaal/core";
import { createAuth } from "../auth";
import type { AppEnv } from "../bindings";

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  const auth = createAuth(db, c.env);
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }

  // No orgId is known yet, so this membership lookup is the one legitimate
  // raw-db query in route-adjacent code — mirrors the blueprint's `.global`
  // escape-hatch usage in middleware/auth.ts.
  const membership = await db.query.users.findFirst({
    where: eq(schema.users.authUserId, result.user.id),
  });
  if (!membership || membership.status === "suspended") {
    return c.json({ error: "no-active-membership" }, 403);
  }

  c.set("session", {
    userId: membership.id,
    orgId: membership.orgId,
    role: membership.role as Role,
  });
  c.set("tenantDb", forOrg(db, membership.orgId));
  await next();
});

export function requireRole(minimum: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { role } = c.get("session");
    if (!roleAtLeast(role, minimum)) {
      return c.json({ error: "forbidden", requiredRole: minimum, role }, 403);
    }
    await next();
  });
}
