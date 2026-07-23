import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@kwartaal/db/auth-schema";
import type { Database } from "@kwartaal/db";
import type { Bindings } from "../bindings";
import { resolveAuthSecret } from "./secret";
import { parseTrustedOrigins } from "./origins";
import { deliverMagicLink } from "../email/deliver-magic-link";
import { provisionOrgForNewUser } from "../lib/provision-org";

/**
 * Instantiated per request (the D1 binding is only available per request).
 * Signup is OPEN on both paths (locked decision #1's blueprint inversion —
 * Hackiwi's disableSignUp: true flipped on both emailAndPassword and
 * magicLink), with an org + BusinessProfile shell auto-created via the
 * user.create.after hook.
 */
export function createAuth(db: Database, env: Bindings) {
  return betterAuth({
    secret: resolveAuthSecret(env),
    baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
    trustedOrigins: parseTrustedOrigins(env.APP_ORIGIN, env.BETTER_AUTH_URL),
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      disableSignUp: false,
    },
    plugins: [
      magicLink({
        disableSignUp: false,
        sendMagicLink: async ({ email, url }) => {
          await deliverMagicLink(env, email, url);
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await provisionOrgForNewUser(db, user.id);
          },
        },
      },
    },
  });
}
