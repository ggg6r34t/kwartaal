import type { Bindings } from "../bindings";
import { sendEmail } from "./resend";
import { renderAuthEmailHtml } from "./auth-email-shell";
import { rewriteToAppOrigin } from "./rewrite-auth-link";
import { AUTH_LINK_EXPIRY_MINUTES } from "../auth/constants";

/**
 * Dev-logs/prod-sends degraded pattern (blueprint §8). Unknown environment
 * values fall through to sending (fail safe — a typo in ENVIRONMENT can't
 * silently downgrade to logging-only in production).
 *
 * Note on anti-enumeration: the blueprint's closed-signup product gates the
 * send on existing membership and swallows failures for a uniform 200. Under
 * Kwartaal's OPEN signup, magic-link sign-in is also how a new account gets
 * created, so there's no "does this email have an account" distinction to
 * leak — Better Auth's own uniform response already covers it. No
 * additional membership gate is needed here.
 */
export async function deliverMagicLink(
  env: Bindings,
  email: string,
  url: string,
): Promise<void> {
  // See rewrite-auth-link.ts: Better Auth builds `url` on BETTER_AUTH_URL
  // (the Worker's own origin), but the resulting cookie only sticks on the
  // app's own origin.
  const link = rewriteToAppOrigin(url, env.APP_ORIGIN);

  if (env.ENVIRONMENT === "development") {
    console.log(`[magic-link] ${email} -> ${link}`);
    return;
  }

  const html = renderAuthEmailHtml({
    preheaderSubject: "Your sign-in link",
    heading: "Your sign-in link",
    bodyHtml: `<p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#7A7266">Click below to sign in to Kwartaal. The link works once and expires in ${AUTH_LINK_EXPIRY_MINUTES} minutes.</p>`,
    ctaLabel: "Sign in to Kwartaal",
    ctaUrl: link,
    afterCtaHtml: `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#A39A8B">Button not working? Paste this into your browser:<br><span style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#7A7266;word-break:break-all">${link}</span></p>`,
    footerHtml:
      "Sent by Kwartaal &middot; mail.kwartaal.app &middot; Amsterdam<br>Didn&rsquo;t request this? You can ignore it &mdash; nothing happens without the link.",
  });
  const text = `Sign in to Kwartaal: ${link}\n\nThis link works once and expires in ${AUTH_LINK_EXPIRY_MINUTES} minutes. Didn't request this? You can ignore it — nothing happens without the link.`;

  await sendEmail(env, { to: email, subject: "Your sign-in link", html, text });
}
