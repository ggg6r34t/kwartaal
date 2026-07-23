import { csrf } from "hono/csrf";
import type { Context } from "hono";
import type { AppEnv } from "../bindings";
import { parseTrustedOrigins } from "../auth/origins";

/**
 * Applied to state-changing route groups, NOT to /api/auth/* (Better Auth
 * runs its own origin check via trustedOrigins — two separate checks
 * guarding two separate route sets, per blueprint §3).
 */
export const csrfGuard = csrf({
  origin: (origin: string, c: Context<AppEnv>) =>
    parseTrustedOrigins(c.env.APP_ORIGIN, c.env.BETTER_AUTH_URL).includes(origin),
});
