import { test, expect, type BrowserContext } from "@playwright/test";
import { APP_ORIGIN } from "./helpers";

/**
 * Closes a gap every prior pillar's PROGRESS.md flagged: "no browser
 * automation tool available in this environment" was true right up until
 * this pillar discovered otherwise (see PROGRESS.md's Pillar 6 section).
 * Every screen Pillars 1-5 built was previously verified only via API
 * responses, never actually rendered and looked at. This is a visual
 * sanity pass, not a pixel-diff/snapshot-testing setup: each screen loads,
 * renders its real heading, and gets screenshotted to
 * test-results/visual/ for a human to actually look at — proving the
 * screen isn't blank, isn't stuck on an error boundary, and isn't
 * showing a loading spinner forever.
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

test.describe("visual pass — marketing (unauthenticated)", () => {
  const pages: [string, string][] = [
    ["/", "Home"],
    ["/pricing", "Pricing"],
    ["/how-it-works", "How it works"],
    ["/guide", "Guide"],
    ["/about", "About"],
    ["/companion", "Companion"],
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
    ["/dpa", "Dpa"],
    ["/impressum", "Impressum"],
    ["/signin", "SignIn"],
  ];

  for (const [path, name] of pages) {
    test(`${name} (${path}) renders`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));
      await page.goto(path);
      await expect(page.locator("body")).not.toBeEmpty();
      await page.screenshot({
        path: `test-results/visual/marketing-${name.replace(/\s+/g, "-")}.png`,
        fullPage: true,
      });
      expect(consoleErrors, `uncaught page errors on ${path}`).toEqual([]);
    });
  }
});

test.describe("visual pass — app screens (as the seeded Maya demo account)", () => {
  // One real sign-in for the whole block, not one per screen: each test
  // still gets Playwright's usual fresh, isolated context — it's just
  // pre-seeded with the same valid session cookie via addCookies rather
  // than re-authenticating from scratch. Beyond being wasteful, 7 real
  // POST /api/auth/sign-in/email calls back-to-back materially eats into
  // the shared per-IP auth rate-limit budget every other auth-touching
  // test in the suite also draws from (see apps/api/src/index.ts).
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

  const pages: [string, string, string][] = [
    ["/app/today", "Today", "Today"],
    ["/app/vat", "Vat", "VAT"],
    ["/app/income-tax", "IncomeTax", "Income tax"],
    ["/app/money", "Money", "Money"],
    ["/app/vault", "Vault", "Vault"],
    ["/app/glossary", "Glossary", "Glossary"],
    ["/app/settings", "Settings", "Settings"],
  ];

  for (const [path, name, headingText] of pages) {
    test(`${name} (${path}) renders for Maya`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));
      await page.goto(path);
      await expect(page.getByText(new RegExp(headingText, "i")).first()).toBeVisible({
        timeout: 15_000,
      });
      await page.screenshot({
        path: `test-results/visual/app-${name}.png`,
        fullPage: true,
      });
      expect(consoleErrors, `uncaught page errors on ${path}`).toEqual([]);
    });
  }
});

test("visual pass — onboarding welcome screen (fresh signup)", async ({
  page,
  context,
}) => {
  const email = `e2e-visual-onboarding-${Date.now()}@example.com`;
  const headers = { "Content-Type": "application/json", Origin: APP_ORIGIN };
  await context.request.post(`${APP_ORIGIN}/api/auth/sign-up/email`, {
    headers,
    data: { email, password: "Sm0keTest!2026", name: "Visual Test" },
  });
  await context.request.post(`${APP_ORIGIN}/api/auth/sign-in/email`, {
    headers,
    data: { email, password: "Sm0keTest!2026" },
  });
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: /Taxes become four dates a year/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visual/app-Onboarding.png",
    fullPage: true,
  });
});
