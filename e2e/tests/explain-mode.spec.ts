import { test, expect } from "@playwright/test";
import { apiSignUp, apiCompleteOnboarding, APP_ORIGIN } from "./helpers";

/**
 * "Explain notes" (docs/design's Learn layer) — default-on for a fresh
 * signup, toggled from Settings, and the toggle survives sign-out/
 * sign-in: the real proof of server persistence, not just in-memory
 * React state.
 */
test("Explain notes: default-on, Settings toggle applies app-wide, survives sign-out/sign-in", async ({
  page,
  context,
}) => {
  const email = `e2e-explain-${Date.now()}@example.com`;
  await apiSignUp(context, email);
  await apiCompleteOnboarding(context);

  await page.goto("/app/today");
  await expect(page.getByText(/One card, one action/)).toBeVisible();

  await page.goto("/app/settings");
  const toggle = page.getByRole("switch", { name: "Show explain notes" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await page.goto("/app/today");
  await expect(page.getByText(/One card, one action/)).toBeHidden();

  // Sign out, sign back in — proves the preference is real server-side
  // persistence, not just this session's React state.
  await context.clearCookies();
  const headers = { "Content-Type": "application/json", Origin: APP_ORIGIN };
  await context.request.post(`${APP_ORIGIN}/api/auth/sign-in/email`, {
    headers,
    data: { email, password: "Sm0keTest!2026" },
  });

  await page.goto("/app/today");
  await expect(page.getByText(/One card, one action/)).toBeHidden();

  await page.goto("/app/settings");
  await expect(page.getByRole("switch", { name: "Show explain notes" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});
