import type { Bindings } from "../bindings";
import { logger } from "../lib/logger";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Staging email safety (environment topology hard rule, see PROGRESS.md's
 * "Environment" section): staging runs the real cron/queue reminder
 * pipeline against real org data, but must never deliver to an arbitrary
 * address the way production does. Production has no allow-list — this
 * only ever gates staging. An unset/empty EMAIL_ALLOWLIST in staging
 * denies everything (fail closed), not "allow everything" — the opposite
 * default would silently reopen the hole the rule exists to close.
 */
function isAllowedRecipient(env: Bindings, to: string): boolean {
  if (env.ENVIRONMENT !== "staging") return true;
  const allowlist = (env.EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(to.trim().toLowerCase());
}

export async function sendEmail(env: Bindings, payload: EmailPayload): Promise<void> {
  if (!isAllowedRecipient(env, payload.to)) {
    // Same dev-logs treatment as local (see deliver-magic-link.ts,
    // deliver-reminder.ts) — never throws, just never actually sends.
    logger.info("staging-email-blocked-not-allowlisted", { to: payload.to });
    return;
  }

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured; cannot send email");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed (${response.status}): ${body}`);
  }
}
