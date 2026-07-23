import type { Bindings } from "../bindings";

const DEV_FALLBACK_SECRET = "dev-insecure-better-auth-secret-do-not-use-in-prod";

/** Allow-list of one; unknown environment throws so a typo can't silently downgrade security. */
export function resolveAuthSecret(env: Bindings): string {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (env.ENVIRONMENT === "development") return DEV_FALLBACK_SECRET;
  throw new Error(
    `BETTER_AUTH_SECRET is not configured for environment "${env.ENVIRONMENT}"`,
  );
}
