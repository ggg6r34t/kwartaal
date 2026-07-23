/**
 * Mirrors apps/api/src/auth/constants.ts (a separate workspace — apps/web
 * never imports apps/api code directly, only packages/core). Keep these
 * two files' values in sync; they only ever change together with a
 * deliberate docs/design update.
 */
export const AUTH_LINK_EXPIRY_MINUTES = 15;
export const INVITE_EXPIRY_DAYS = 7;
