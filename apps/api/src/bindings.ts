import type { Database, TenantDb } from "@kwartaal/db";
import type { ReminderStage, Role } from "@kwartaal/core";

export interface ReminderQueueMessage {
  kind: "reminder";
  orgId: string;
  deadlineId: string;
  stage: ReminderStage;
}

export interface ExportQueueMessage {
  kind: "export";
  orgId: string;
  exportJobId: string;
}

export interface Bindings {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  BACKUPS: R2Bucket;
  REMINDER_QUEUE: Queue<ReminderQueueMessage>;
  EXPORT_QUEUE: Queue<ExportQueueMessage>;
  BROWSER: Fetcher;

  ENVIRONMENT: string;
  BETTER_AUTH_URL: string;
  APP_ORIGIN: string;
  EMAIL_FROM: string;
  // Comma-separated recipient allow-list, staging-only (see
  // email/resend.ts's isAllowedRecipient). Not secret — just addresses,
  // safe as a plain var. Unset/empty in staging means nothing is
  // allowed (deny-by-default), never "everything is allowed". Never read
  // in production — production has no allow-list by design.
  EMAIL_ALLOWLIST?: string;
  // Stripe Price ids (not secret — safe as plain vars). Placeholders until a
  // real Stripe account exists; see lib/stripe.ts and PROGRESS.md.
  STRIPE_PRICE_MONTHLY: string;
  STRIPE_PRICE_ANNUAL: string;

  // Secrets (wrangler secret put) — absent in local dev, where degraded
  // modes take over (see lib/secrets.ts, email/resend.ts, auth/secret.ts,
  // lib/stripe.ts).
  BETTER_AUTH_SECRET?: string;
  SECRETS_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  SENTRY_DSN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export interface SessionInfo {
  userId: string;
  orgId: string;
  role: Role;
}

export interface Variables {
  /**
   * The unscoped Drizzle client. Only for: the Better Auth handler, the
   * health checks, and requireSession's own membership lookup (which by
   * definition happens before an orgId is known). Route modules must never
   * read this — see the no-raw-database ESLint rule in apps/api/.eslintrc.
   */
  db: Database;
  /** Set by requireSession; the only DB handle route modules should use. */
  tenantDb: TenantDb;
  session: SessionInfo;
  requestId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
