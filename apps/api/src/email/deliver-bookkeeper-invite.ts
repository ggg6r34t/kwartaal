import type { Bindings } from "../bindings";
import { sendEmail } from "./resend";
import { renderAuthEmailHtml } from "./auth-email-shell";
import { INVITE_EXPIRY_DAYS } from "../auth/constants";

/**
 * Same dev-logs/prod-sends degraded pattern as deliver-magic-link.ts.
 * acceptUrl already points at APP_ORIGIN (see routes/invites.ts) — no
 * origin rewrite needed, unlike the magic-link/reset-password emails.
 */
export async function deliverBookkeeperInvite(
  env: Bindings,
  email: string,
  orgName: string,
  invitedByName: string,
  acceptUrl: string,
): Promise<void> {
  const subject = `${invitedByName} invited you to Kwartaal`;

  if (env.ENVIRONMENT === "development") {
    console.log(`[bookkeeper-invite] ${email} -> ${acceptUrl}`);
    return;
  }

  const html = renderAuthEmailHtml({
    preheaderSubject: subject,
    heading: `${invitedByName} invited you to view her administration`,
    bodyHtml: `<p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#7A7266">A read-only seat on <strong style="color:#1F1B16">${orgName}</strong>: view and export her quarters and figures. No changes, ever. The invite is valid for ${INVITE_EXPIRY_DAYS} days.</p>`,
    ctaLabel: "View the invite",
    ctaUrl: acceptUrl,
    afterCtaHtml: `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#A39A8B">Kwartaal is a tax companion for Dutch freelancers. You&rsquo;ll be able to see ${invitedByName}&rsquo;s figures the way she sees them &mdash; nothing more.</p>`,
    footerHtml: `Sent by Kwartaal on behalf of ${invitedByName} &middot; mail.kwartaal.app &middot; Amsterdam<br>Don&rsquo;t know ${invitedByName}, or don&rsquo;t want this? You can ignore it &mdash; nothing is shared unless you accept.`,
  });
  const text = `${invitedByName} invited you to a read-only seat on ${orgName}'s Kwartaal account: view and export her quarters and figures, no changes. Accept: ${acceptUrl} (sign in with this email address). Expires in ${INVITE_EXPIRY_DAYS} days.`;

  await sendEmail(env, { to: email, subject, html, text });
}
