import type { Bindings } from "../bindings";
import { sendEmail } from "./resend";

/** Same dev-logs/prod-sends degraded pattern as deliver-magic-link.ts (blueprint §8). */
export async function deliverReminderEmail(
  env: Bindings,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  if (env.ENVIRONMENT === "development") {
    console.log(`[reminder] ${to} -> ${subject}`);
    return;
  }
  await sendEmail(env, { to, subject, html, text });
}
