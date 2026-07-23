/**
 * Better Auth builds magic-link/reset-password verification URLs on its own
 * `baseURL` (env.BETTER_AUTH_URL — the Worker's own origin), but the
 * resulting session cookie only sticks once the browser is back on the
 * app's origin: apps/web/functions/api/[[path]].ts (and vite.config.ts's
 * dev-time twin) exist specifically because a cookie set cross-site from
 * the Worker's own origin never comes back on the app's subsequent
 * requests. A clicked email link is a raw top-level navigation, not a
 * fetch() the SPA's proxy can intercept — so without this rewrite, the
 * Set-Cookie from clicking the link would land on the Worker's origin,
 * never on the app's, and the user would arrive at the app signed out.
 * Rewriting the origin to the app's own (keeping Better Auth's path/query
 * untouched — /api/auth/... is exactly what the proxy already forwards)
 * routes the click through the same same-origin proxy every other auth
 * request already uses.
 */
export function rewriteToAppOrigin(url: string, appOrigin: string): string {
  const primary = appOrigin.split(",")[0]?.trim();
  if (!primary) return url;
  const parsed = new URL(url);
  const app = new URL(primary);
  parsed.protocol = app.protocol;
  parsed.host = app.host;
  return parsed.toString();
}
