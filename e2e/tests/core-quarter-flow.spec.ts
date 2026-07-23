import { test, expect } from "@playwright/test";
import { apiSignUp } from "./helpers";

/**
 * Plan's primary flow 1: "signup → onboarding → Pro trial → enter Q3 lines
 * → mirror → mark filed+paid → drawer closed + Today updates". Sign-up
 * itself is done via the API (see helpers.ts — the UI's magic-link screen
 * has no password field to drive headlessly; it's covered by the separate
 * visual pass instead), but onboarding onward is driven through real
 * rendered screens end to end.
 *
 * NOT covered here, and explicitly out of reach in this environment:
 * "gates drop at next quarter, trial data read-only → subscribe → gates
 * reopen." That needs either crossing a real quarter boundary (no
 * time-travel exists for a live `wrangler dev` process — only the
 * vitest-pool-workers harness supports scheduledTime override, see
 * apps/api/src/integration/year-rollover.test.ts, which already proves
 * the gate-drop logic itself) or a real Stripe account for the
 * subscribe step (still BLOCKED — no Stripe account exists, see
 * PROGRESS.md). The entitlement gate and trial-lifecycle logic are
 * already proven server-side by test elsewhere; this flow proves the
 * browser can complete everything up to and including the first
 * drawer-close.
 */
test("signup → onboarding → Q3 lines → mirror → filed+paid → drawer closed", async ({
  page,
  context,
}) => {
  const email = `e2e-core-${Date.now()}@example.com`;
  await apiSignUp(context, email);

  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: /Taxes become four dates a year/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Set up my tax year" }).click();

  // Step 1: business — eenmanszaak, default (current) KVK year.
  await expect(
    page.getByRole("heading", { name: /What did you register at the KVK/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Eenmanszaak", exact: false }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: btw — leave the default turnover (above the KOR limit), quarterly filing.
  await expect(
    page.getByRole("heading", { name: /Roughly how much will you invoice/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: money reserve — leave the 30% default.
  await expect(
    page.getByRole("heading", { name: /how much should never feel like yours/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: reminders — leave "Persistent" (default), submit.
  await expect(
    page.getByRole("heading", { name: /How loudly should we remind you/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: done.
  await expect(
    page.getByRole("heading", { name: /Your tax year is set up/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open Today" }).click();
  await expect(page).toHaveURL(/\/app\/today/);

  // Q3 is the current quarter (today's date is 2026-07-23 in this repo's
  // demo framing) — VAT screen focuses the first non-paid quarter automatically.
  await page.goto("/app/vat");
  await expect(page.getByRole("heading", { name: /VAT — Q3 2026/ })).toBeVisible();

  // Step 1: one income line.
  await page.getByLabel("Date").fill("2026-07-15");
  await page.getByLabel("Description").fill("E2E test invoice");
  await page.getByLabel("Amount ex btw").fill("1000,00");
  await page.getByRole("button", { name: "21%" }).first().click();
  await page.getByRole("button", { name: "Add invoice" }).click();
  await expect(page.getByText("E2E test invoice")).toBeVisible();
  await page.getByRole("button", { name: "These are right → expenses" }).click();

  // Step 2: one expense line.
  await page.getByLabel("Date").fill("2026-07-16");
  await page.getByLabel("Supplier").fill("E2E test supplier");
  await page.getByLabel("Amount ex btw").fill("100,00");
  await page.getByRole("button", { name: "21%" }).first().click();
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText("E2E test supplier")).toBeVisible();
  await page.getByRole("button", { name: "These are right → the mirror" }).click();

  // Step 3: the mirror — 21% of €1.000 = €210 received, 21% of €100 = €21
  // paid, owed = €189.
  await expect(page.getByText("You owe the Belastingdienst")).toBeVisible();
  await expect(page.getByText("€ 189,00").or(page.getByText("€189,00"))).toBeVisible();
  await page.getByRole("button", { name: "Looks right → prepare the handoff" }).click();

  // Step 4: handoff — file, then pay. The pay response itself carries
  // firstQuarterJustClosed — the definitive signal, captured directly
  // rather than relying on catching the "Q3 is closed" celebratory banner
  // in the DOM: paying immediately triggers a quarters refetch, and since
  // Q3 is now the only paid quarter, `focusQuarter` advances straight to
  // Q4 and the checklist remounts (new `key={focusQuarter.id}`) — on this
  // fast a local server that remount can beat the banner onto the screen,
  // so asserting on the response body is the reliable check; the banner
  // itself is a real but timing-sensitive nice-to-have, noted in PROGRESS.md.
  await expect(page.getByText("Totaal te betalen")).toBeVisible();
  await page.getByRole("checkbox", { name: /I filed it/ }).click();
  const [payResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/pay") && res.request().method() === "POST",
    ),
    page.getByRole("checkbox", { name: /I paid it/ }).click(),
  ]);
  const payBody = (await payResponse.json()) as { firstQuarterJustClosed: boolean };
  expect(payBody.firstQuarterJustClosed).toBe(true);

  // The VAT screen has moved on to Q4's fresh, empty checklist.
  await expect(page.getByRole("heading", { name: /VAT — Q4 2026/ })).toBeVisible();

  // Today reflects the closed quarter after navigating back.
  await page.goto("/app/today");
  await expect(page.getByText(/Q3/).first()).toBeVisible();
});
