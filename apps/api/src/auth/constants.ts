/**
 * Shared by auth/index.ts's Better Auth config and the magic-link/reset
 * email copy — one number so the emailed "expires in 15 minutes" text can
 * never drift from what Better Auth actually enforces. Matches docs/
 * design's Auth session `linkExpiryMinutes` default (15).
 */
export const AUTH_LINK_EXPIRY_SECONDS = 15 * 60;
export const AUTH_LINK_EXPIRY_MINUTES = AUTH_LINK_EXPIRY_SECONDS / 60;

/** Matches docs/design's `inviteExpiryDays` default (7); also apps/api/src/routes/invites.ts's INVITE_TTL_MS. */
export const INVITE_EXPIRY_DAYS = 7;
