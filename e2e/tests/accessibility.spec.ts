import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * KWARTAAL-BUILD-PLAN.md's "Self-accessibility" requirement: the marketing
 * site scores 0 critical issues in CI, self-contained — no external tool,
 * account, or deployed environment involved. Runs against the real built
 * output (`npm run build:web` → `apps/web/dist`, served by `vite preview`
 * via playwright.a11y.config.ts), not a mock. WCAG 2.1/2.2 A+AA tags match
 * the plan's stated target.
 */
const MARKETING_PAGES = [
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

for (const path of MARKETING_PAGES) {
  test(`${path || "/"} has no critical or serious axe violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    if (blocking.length > 0) {
      const detail = blocking
        .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
        .join("\n");
      console.log(`Accessibility violations on ${path}:\n${detail}`);
    }
    expect(blocking, `critical/serious axe violations on ${path}`).toEqual([]);
  });
}
