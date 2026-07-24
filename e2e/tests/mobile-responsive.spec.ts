import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { APP_ORIGIN, apiGetOrgId, d1Execute, d1QueryFirst } from "./helpers";

/**
 * Phase B's gate: the four phone-critical moments at 390px, marketing Home
 * at 390 and 1280, and a no-horizontal-scroll assertion across every
 * surface Phase A's audit measured. Objective overflow detection (not
 * eyeballed) via `document.documentElement.scrollWidth` vs `clientWidth`
 * — same technique the Phase A audit script used.
 */

async function signInAsMaya(context: BrowserContext): Promise<void> {
  const headers = { "Content-Type": "application/json", Origin: APP_ORIGIN };
  const res = await context.request.post(`${APP_ORIGIN}/api/auth/sign-in/email`, {
    headers,
    data: { email: "maya@kwartaal-demo.example", password: "kwartaal-demo-2026" },
  });
  if (!res.ok()) {
    throw new Error(`Maya sign-in failed: ${res.status()} ${await res.text()}`);
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `${label}: scrollWidth ${overflow.scrollWidth} vs clientWidth ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth);
}

test.describe("no horizontal overflow at 390px — every audited surface", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const marketingPages = [
    "/",
    "/pricing",
    "/how-it-works",
    "/guide",
    "/about",
    "/companion",
    "/privacy",
    "/terms",
    "/dpa",
    "/impressum",
  ];

  for (const path of marketingPages) {
    test(`marketing ${path}`, async ({ page }) => {
      await page.goto(path);
      await assertNoHorizontalOverflow(page, path);
    });
  }

  test.describe("dashboard (as Maya)", () => {
    let mayaCookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];

    test.beforeAll(async ({ browser }) => {
      const setupContext = await browser.newContext();
      await signInAsMaya(setupContext);
      mayaCookies = await setupContext.cookies();
      await setupContext.close();
    });

    test.beforeEach(async ({ context }) => {
      await context.addCookies(mayaCookies);
    });

    const dashboardPages = [
      "/app/today",
      "/app/vat",
      "/app/income-tax",
      "/app/money",
      "/app/vault",
      "/app/glossary",
      "/app/settings",
    ];

    for (const path of dashboardPages) {
      test(`dashboard ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await assertNoHorizontalOverflow(page, path);
      });
    }
  });
});

test.describe("marketing Home — 390 and 1280", () => {
  test("mobile: hamburger + condensed nav, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await assertNoHorizontalOverflow(page, "Home @390");
    await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "How it works", exact: true }),
    ).toBeHidden();

    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(
      page.getByRole("link", { name: "How it works", exact: true }),
    ).toBeVisible();
  });

  test("desktop: full nav, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await assertNoHorizontalOverflow(page, "Home @1280");
    await expect(page.getByRole("button", { name: /open menu/i })).toBeHidden();
    await expect(
      page.getByRole("link", { name: "How it works", exact: true }),
    ).toBeVisible();
  });
});

test.describe("the four phone-critical moments @ 390px (as Maya)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  let mayaCookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
  let orgId = "";

  test.beforeAll(async ({ browser }) => {
    const setupContext = await browser.newContext();
    await signInAsMaya(setupContext);
    orgId = await apiGetOrgId(setupContext);
    mayaCookies = await setupContext.cookies();
    await setupContext.close();
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies(mayaCookies);
  });

  test("Moment 1 — Today: bottom tab bar, handoff choice, remind-tonight + undo", async ({
    page,
  }) => {
    // Today's HeroCard shows the earliest non-handled/paid quarter's own
    // btw_q deadline — there's no independent "throwaway deadline" to
    // seed without also fabricating a matching quarter row (which risks
    // itself becoming the new focus quarter and interfering with other
    // tests). Instead: capture Maya's real Q3 due date, mutate it for
    // this test's duration, and restore it in `finally` — the demo
    // account's canonical October date must survive this test, not just
    // this one assertion (see AUDIT-REPORT.md R-002: a prior version of
    // this test corrupted that date for the rest of the suite/session).
    const targetDeadline = d1QueryFirst<{ id: string; due_date: string }>(
      `SELECT id, due_date FROM deadlines WHERE org_id = '${orgId}' AND kind = 'btw_q'
       AND quarter_id = (SELECT id FROM quarters WHERE org_id = '${orgId}' AND status NOT IN ('handled_elsewhere','paid') ORDER BY q LIMIT 1)`,
    );
    if (!targetDeadline) throw new Error("no actionable btw_q deadline found for Maya");
    const originalDueDate = targetDeadline.due_date;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 9);
    const dueDateIso = dueDate.toISOString().slice(0, 10);

    try {
      d1Execute(
        `UPDATE deadlines SET due_date = '${dueDateIso}', same_day_reminder_requested_at = NULL
         WHERE id = '${targetDeadline.id}'`,
      );

      await page.goto("/app/today");
      await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Today", exact: true })).toBeVisible();

      const remindButton = page.getByRole("button", {
        name: "Remind me at my laptop tonight",
      });
      await expect(remindButton).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Start on the phone anyway" }),
      ).toBeVisible();

      await remindButton.click();
      await expect(page.getByText(/Reminder set for 19:00/)).toBeVisible();

      const deadlineRow = d1QueryFirst<{
        same_day_reminder_requested_at: number | null;
      }>(
        `SELECT same_day_reminder_requested_at FROM deadlines WHERE id = '${targetDeadline.id}'`,
      );
      expect(deadlineRow?.same_day_reminder_requested_at).not.toBeNull();

      await page.getByRole("button", { name: "Undo" }).click();
      await expect(remindButton).toBeVisible();
    } finally {
      d1Execute(
        `UPDATE deadlines SET due_date = '${originalDueDate}', same_day_reminder_requested_at = NULL
         WHERE id = '${targetDeadline.id}'`,
      );
    }
  });

  test("Moment 2 — Vault: camera-first capture input, note fallback over threshold", async ({
    page,
  }) => {
    await page.goto("/app/vault");
    await expect(page.getByRole("heading", { name: "Vault" })).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("capture", "environment");

    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    await fileInput.setInputFiles({
      name: "receipt.jpg",
      mimeType: "image/jpeg",
      buffer,
    });
    await expect(page.getByText("Uploaded ✓")).toBeVisible();

    await page.getByLabel("Amount").fill("150,00");
    await expect(page.getByText(/Over €100/)).toBeVisible();
    const saveWithNote = page.getByRole("button", { name: "Save with a note" });
    await expect(saveWithNote).toBeVisible();

    // First click reveals the note field (nothing to submit yet — the
    // note-fallback rule requires a non-empty note before it'll save).
    await saveWithNote.click();
    await page.getByLabel("Note").fill("Client lunch, name missing from receipt.");
    await saveWithNote.click();
    await expect(page.getByText(/In the Vault\. Kept for 7 years/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Catch another receipt" }),
    ).toBeVisible();
  });

  test("Moment 3 — Money: split ritual done/remind-tonight choice", async ({ page }) => {
    await page.goto("/app/money");
    await expect(page.getByRole("heading", { name: "Money" })).toBeVisible();

    await page.getByLabel("Invoice reference").fill(`E2E-${Date.now()}`);
    const doneButton = page.getByRole("button", { name: "I moved it — done" });
    const remindButton = page.getByRole("button", { name: "Remind me tonight" });
    await expect(doneButton).toBeVisible();
    await expect(remindButton).toBeVisible();

    await remindButton.click();
    await expect(page.getByText(/pinned to Today until it's moved/)).toBeVisible();

    await page.goto("/app/today");
    await expect(page.getByText(/move.*to the Taxes pot/i).first()).toBeVisible();
  });

  test("Moment 4 — Vault: hours week view quick-add chips", async ({ page }) => {
    await page.goto("/app/vault");
    await expect(page.getByRole("heading", { name: "Vault" })).toBeVisible();
    await expect(page.getByRole("list", { name: "This week" })).toBeVisible();

    const addTwo = page.getByRole("button", { name: "+2u" });
    await expect(addTwo).toBeVisible();
    await addTwo.click();
    await expect(page.getByText(/Logged — tap another chip/)).toBeVisible();

    await page.getByRole("button", { name: "undo" }).click();
    await expect(page.getByText(/Logged — tap another chip/)).toBeHidden();
  });
});
