interface Env {
  API: Fetcher;
}

/**
 * Prod parity of the dev Vite proxy (vite.config.ts) — the pair must stay in
 * agreement. Same-origin cookie fix: app on the Pages origin and the Worker
 * API are otherwise cross-site, so a SameSite=Lax session cookie set by the
 * Worker would never come back on subsequent requests. Serving the API from
 * the app's own origin keeps the cookie first-party.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith("/api/auth")) {
    url.pathname = url.pathname.replace(/^\/api/, "");
  }
  // `new Request(url, context.request)` silently drops the Origin header
  // when copying headers from an existing Request object — Origin is a
  // forbidden/restricted header name per the Fetch spec, and that
  // restriction applies even to this same-process service-binding
  // "fetch". Without it, the Worker's CSRF/trustedOrigins check sees no
  // Origin at all and rejects every state-changing request. Re-set it
  // explicitly from the original request, which Workers' Headers API
  // does allow (unlike real browser JS).
  const forwarded = new Request(url, context.request);
  const origin = context.request.headers.get("Origin");
  if (origin) forwarded.headers.set("Origin", origin);
  return context.env.API.fetch(forwarded);
};
