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
import { deliverPasswordReset } from "../email/deliver-password-reset";
import { provisionOrgForNewUser } from "../lib/provision-org";
import { consumeInviteIfPending } from "../lib/consume-invite";
import { AUTH_LINK_EXPIRY_SECONDS } from "./constants";

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
      // Matches docs/design's reset-password hint copy ("At least 10
      // characters") — one number governs both signup and reset since
      // Better Auth's minPasswordLength is global to emailAndPassword.
      minPasswordLength: 10,
      disableSignUp: false,
      resetPasswordTokenExpiresIn: AUTH_LINK_EXPIRY_SECONDS,
      sendResetPassword: async ({ user, url }) => {
        await deliverPasswordReset(env, user.email, url);
      },
    },
    plugins: [
      magicLink({
        disableSignUp: false,
        expiresIn: AUTH_LINK_EXPIRY_SECONDS,
        sendMagicLink: async ({ email, url }) => {
          await deliverMagicLink(env, email, url);
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Mutually exclusive: a pending bookkeeper invite attaches this
            // brand-new authUser to the INVITING org instead of the default
            // auto-provisioned one — see lib/consume-invite.ts.
            const joinedViaInvite = await consumeInviteIfPending(db, user.id, user.email);
            if (!joinedViaInvite) {
              await provisionOrgForNewUser(db, user.id);
            }
          },
        },
      },
    },
  });
}
