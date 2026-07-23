import type { Bindings } from "../bindings";
import { sendEmail } from "./resend";

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
  if (env.ENVIRONMENT === "development") {
    console.log(`[magic-link] ${email} -> ${url}`);
    return;
  }
  await sendEmail(env, {
    to: email,
    subject: "Sign in to Kwartaal",
    html: `<p>Click to sign in to Kwartaal: <a href="${url}">${url}</a></p><p>This link expires shortly and can only be used once.</p>`,
    text: `Sign in to Kwartaal: ${url}`,
  });
}
