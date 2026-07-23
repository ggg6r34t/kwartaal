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
  return context.env.API.fetch(new Request(url, context.request));
};
