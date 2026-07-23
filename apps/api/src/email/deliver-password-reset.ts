import type { Bindings } from "../bindings";
import { sendEmail } from "./resend";
import { renderAuthEmailHtml } from "./auth-email-shell";
import { rewriteToAppOrigin } from "./rewrite-auth-link";
import { AUTH_LINK_EXPIRY_MINUTES } from "../auth/constants";

/**
 * Same dev-logs/prod-sends degraded pattern as deliver-magic-link.ts.
 * requestPasswordReset (see auth/index.ts's sendResetPassword) already has
 * anti-enumeration built into Better Auth itself — this only ever runs for
 * emails that resolve to a real user, so no additional send-gate is needed
 * here (mirrors deliver-magic-link.ts's note on the same point).
 */
export async function deliverPasswordReset(
  env: Bindings,
  email: string,
  url: string,
): Promise<void> {
  // See rewrite-auth-link.ts.
  const link = rewriteToAppOrigin(url, env.APP_ORIGIN);

  if (env.ENVIRONMENT === "development") {
    console.log(`[password-reset] ${email} -> ${link}`);
    return;
  }

  const html = renderAuthEmailHtml({
    preheaderSubject: "Reset your password",
    heading: "Reset your password",
    bodyHtml: `<p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#7A7266">Someone asked to reset the password for this address. If that was you, click below — the link expires in ${AUTH_LINK_EXPIRY_MINUTES} minutes.</p>`,
    ctaLabel: "Choose a new password",
    ctaUrl: link,
    afterCtaHtml: `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#A39A8B">Your current password keeps working until you set a new one.</p>`,
    footerHtml:
      "Sent by Kwartaal &middot; mail.kwartaal.app &middot; Amsterdam<br>Didn&rsquo;t request this? You can ignore it &mdash; nothing changes without the link.",
  });
  const text = `Reset your Kwartaal password: ${link}\n\nThe link expires in ${AUTH_LINK_EXPIRY_MINUTES} minutes. Your current password keeps working until you set a new one. Didn't request this? You can ignore it.`;

  await sendEmail(env, { to: email, subject: "Reset your password", html, text });
}
