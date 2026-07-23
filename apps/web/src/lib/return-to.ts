/**
 * Redirect discipline: the post-auth destination is the in-app origin
 * only. `returnTo` round-trips through the URL bar (and, for the magic-
 * link path, through an emailed link) — a same-origin relative path is the
 * only shape ever trusted; anything else (absolute URLs, protocol-relative
 * `//evil.example`, encoded scheme tricks) falls back instead of being
 * used, so this can never become an open redirect.
 */
export function sanitizeReturnTo(
  value: string | null | undefined,
  fallback = "/app",
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (/[\s\\]/.test(value)) return fallback;
  return value;
}
