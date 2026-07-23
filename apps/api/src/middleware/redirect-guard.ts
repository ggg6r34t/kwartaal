import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../bindings";
import { parseTrustedOrigins } from "../auth/origins";

/**
 * Better Auth's magic-link endpoints don't run an originCheck on
 * callbackURL/errorCallbackURL/newUserCallbackURL the way its own
 * requestPasswordReset does on redirectTo (verified against the installed
 * better-auth version's source) — so nothing server-side stops a direct
 * API call from setting one of these to an attacker-controlled URL. Since
 * a real session cookie gets set before the redirect fires, an unchecked
 * callbackURL is a genuine phishing vector (the email is legitimately from
 * Kwartaal; only the post-auth landing page is hostile). This is the
 * "never open redirects" half of redirect discipline — the client-side
 * half (lib/return-to.ts) covers the app's own in-app returnTo param.
 *
 * Scoped to POST bodies and GET query strings on /api/auth/* only; every
 * other route either doesn't accept a redirect-shaped param or already has
 * its own origin check (see routes/invite-preview.ts, which never redirects).
 */
const REDIRECT_PARAM_NAMES = [
  "callbackURL",
  "errorCallbackURL",
  "newUserCallbackURL",
  "redirectTo",
] as const;

function isTrusted(value: string, trustedOrigins: string[]): boolean {
  let origin: string;
  try {
    origin = new URL(value).origin;
  } catch {
    // Not parseable as an absolute URL — Better Auth resolves relative
    // values against its OWN baseURL (the Worker's origin), which is
    // always trusted by construction.
    return true;
  }
  return trustedOrigins.includes(origin);
}

export const redirectGuard = createMiddleware<AppEnv>(async (c, next) => {
  const trustedOrigins = parseTrustedOrigins(c.env.APP_ORIGIN, c.env.BETTER_AUTH_URL);

  const url = new URL(c.req.url);
  for (const name of REDIRECT_PARAM_NAMES) {
    const queryValue = url.searchParams.get(name);
    if (queryValue && !isTrusted(queryValue, trustedOrigins)) {
      return c.json({ error: "untrusted-redirect" }, 400);
    }
  }

  if (c.req.method === "POST") {
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("application/json")) {
      // Cloned so the real handler downstream can still read the body.
      const body = await c.req.raw
        .clone()
        .json()
        .catch(() => null as Record<string, unknown> | null);
      if (body && typeof body === "object") {
        for (const name of REDIRECT_PARAM_NAMES) {
          const value = (body as Record<string, unknown>)[name];
          if (typeof value === "string" && !isTrusted(value, trustedOrigins)) {
            return c.json({ error: "untrusted-redirect" }, 400);
          }
        }
      }
    }
  }

  await next();
});
