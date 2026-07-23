import type { Bindings } from "../bindings";
import { sendEmail } from "./resend";

/** Same dev-logs/prod-sends degraded pattern as deliver-magic-link.ts (blueprint §8). */
export async function deliverBookkeeperInvite(
  env: Bindings,
  email: string,
  orgName: string,
  acceptUrl: string,
): Promise<void> {
  const subject = `You've been invited to ${orgName} on Kwartaal`;
  const html = `<p>You've been invited as a bookkeeper (read-only) on <strong>${orgName}</strong>'s Kwartaal account.</p><p><a href="${acceptUrl}">Accept the invite</a> — sign in with this email address to join.</p><p>This invite expires in 7 days.</p>`;
  const text = `You've been invited as a bookkeeper on ${orgName}'s Kwartaal account. Accept: ${acceptUrl} (sign in with this email address). Expires in 7 days.`;

  if (env.ENVIRONMENT === "development") {
    console.log(`[bookkeeper-invite] ${email} -> ${acceptUrl}`);
    return;
  }
  await sendEmail(env, { to: email, subject, html, text });
}
