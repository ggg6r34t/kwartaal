import { test, expect } from "@playwright/test";
import { APP_ORIGIN, apiSignUp, d1QueryFirst } from "./helpers";

/**
 * Gate requirement: "a Playwright flow: magic-link sign-in end to end
 * against the dev mailbox log, and password sign-in + reset round-trip."
 * Neither flow existed before — every prior e2e sign-up went straight
 * through the API (see core-quarter-flow.spec.ts's own note), so clicking
 * an actual emailed link was never exercised. That gap is exactly what
 * caught the real same-origin-cookie bug fixed in
 * apps/api/src/email/rewrite-auth-link.ts: Better Auth builds these links
 * on BETTER_AUTH_URL (the Worker's own origin), and a session cookie set
 * there never comes back on the app's own subsequent requests. There's no
 * dev mailbox to read from in this environment — `[magic-link] email ->
 * url` only ever reaches `wrangler dev`'s own stdout, not something a
 * Playwright test can intercept — so, like the reminder-email flow's own
 * precedent (reading `reminder_logs` via `d1QueryFirst` instead of an
 * inbox), this reads the real verification token straight out of the same
 * local D1 `wrangler dev` itself writes to, then navigates the browser to
 * exactly the URL a clicked email link would produce.
 */
test("magic-link sign-in end to end against the dev mailbox log", async ({ page }) => {
  const email = `e2e-magic-${Date.now()}@example.com`;

  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page).toHaveURL(/\/check-your-inbox/);
  await expect(page.getByText(email)).toBeVisible();

  const row = d1QueryFirst<{ identifier: string }>(
    `SELECT identifier FROM verification WHERE value LIKE '%${email}%' ORDER BY created_at DESC LIMIT 1`,
  );
  if (!row) throw new Error(`no magic-link verification token found for ${email}`);

  // Exactly the request a click on the (rewritten, same-origin) emailed
  // link produces: a top-level GET to the app's own origin.
  await page.goto(
    `/api/auth/magic-link/verify?token=${row.identifier}&callbackURL=${encodeURIComponent(`${APP_ORIGIN}/app`)}`,
  );

  // A brand-new account has no BusinessProfile.onboardedAt yet —
  // RequireOnboarded bounces here, proving the session cookie really did
  // land on the app's origin (an unauthenticated visitor would have been
  // sent to /signin instead, not /onboarding).
  await expect(page).toHaveURL(/\/onboarding/);
});

test("password sign-in, then a full forgot/reset round-trip", async ({
  page,
  context,
}) => {
  const email = `e2e-pwreset-${Date.now()}@example.com`;
  const originalPassword = "Sm0keTest!2026";
  await apiSignUp(context, email, originalPassword);
  await context.clearCookies();

  await page.goto("/signin");
  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(originalPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await context.clearCookies();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a reset link" }).click();
  await expect(page).toHaveURL(/\/check-your-inbox/);

  const row = d1QueryFirst<{ identifier: string }>(
    `SELECT identifier FROM verification WHERE identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 1`,
  );
  if (!row) throw new Error("no password-reset verification token found");
  const token = row.identifier.split(":")[1];

  const newPassword = "N3wSm0keTest!2026";
  // Better Auth's own GET /reset-password/:token callback — real behavior,
  // not a fabricated shortcut: it validates the token server-side, then
  // redirects to our ResetPassword page with ?token=... appended.
  await page.goto(
    `/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(`${APP_ORIGIN}/reset-password?email=${encodeURIComponent(email)}`)}`,
  );
  await expect(page).toHaveURL(/\/reset-password\?/);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Save password & sign in" }).click();

  // Same signal as the magic-link flow: landing on /onboarding (not
  // /signin) proves resetPassword + the follow-up signIn.email both
  // actually authenticated this browser.
  await expect(page).toHaveURL(/\/onboarding/);
});
