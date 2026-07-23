import { test, expect } from "@playwright/test";

/**
 * Proves the real cutover, against the real deployed hostname — not a
 * local stand-in. Deliberately self-contained (no helpers.ts import: those
 * helpers assume a local `wrangler dev` D1 file, which has no meaning
 * here) and deliberately narrow: this checks that DNS + the Pages custom
 * domain + the same-origin proxy + a real sign-in all work together on
 * staging.kwartaal.app, not the full app surface (that's what the local
 * suite is for).
 */
test("staging.kwartaal.app: health check responds through the same-origin proxy", async ({
  request,
}) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { ok: boolean; environment: string };
  expect(body).toMatchObject({ ok: true, environment: "staging" });
});

test("staging.kwartaal.app: the marketing home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("staging.kwartaal.app: Maya's seeded demo account signs in and Today renders", async ({
  page,
  context,
}) => {
  // context.request, not the standalone `request` fixture — they're
  // separate cookie jars in Playwright. Only a cookie set via the same
  // BrowserContext `page` uses will actually be sent on page.goto().
  const signInRes = await context.request.post("/api/auth/sign-in/email", {
    headers: {
      "Content-Type": "application/json",
      Origin: "https://staging.kwartaal.app",
    },
    data: { email: "maya@kwartaal-demo.example", password: "kwartaal-demo-2026" },
  });
  expect(signInRes.ok(), await signInRes.text()).toBe(true);

  await page.goto("/app/today");
  await expect(page.getByText(/Today/i).first()).toBeVisible({ timeout: 15_000 });
});
