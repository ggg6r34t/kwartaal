import { test, expect } from "@playwright/test";
import { apiCompleteOnboarding, apiSignUp } from "./helpers";

// A minimal but real, valid 1x1 PNG (not just arbitrary bytes) — this is a
// browser <input type=file> flow, so it should look like a real image file
// to be a faithful test, even though the server itself only checks content-type.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/**
 * Plan's primary flow 2: "receipt capture → vault → export-zip contains
 * it." Onboarding is completed via the API here (helpers.ts) — this flow
 * is about the Vault, not re-proving onboarding, which flow 1 already
 * exercises through the real UI.
 */
test("receipt capture → vault → export-zip contains the receipt", async ({
  page,
  context,
}) => {
  const email = `e2e-vault-${Date.now()}@example.com`;
  await apiSignUp(context, email);
  await apiCompleteOnboarding(context);

  await page.goto("/app/vault");
  await expect(page.getByRole("heading", { name: "Vault" })).toBeVisible();

  // The visible button just calls fileInputRef.current?.click() on a
  // hidden <input type=file> — setting it directly is the reliable way to
  // drive that in headless Chromium (a real "filechooser" event doesn't
  // consistently fire for a programmatic .click() the way it does for a
  // genuine user click on the input itself).
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-receipt.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG,
  });

  await expect(page.getByText("Uploaded ✓")).toBeVisible({ timeout: 15_000 });

  // Confirm two of the six checklist elements — the missing-count updates.
  await page.getByRole("button", { name: "Date", exact: true }).click();
  await page.getByRole("button", { name: "Supplier name + address" }).click();
  await expect(page.getByText(/4 still missing/)).toBeVisible();

  // The receipt shows up in Recent records — labeled by the server-issued
  // r2Key (rcpt_<id>.png), not the client's original filename (see
  // Vault.tsx's RecentRecords, which reads r2Key.split("/").pop()).
  await expect(page.getByText(/^rcpt_.*\.png$/)).toBeVisible();

  // Full account export — enqueued, processed by the local queue consumer
  // (wrangler dev's real local Queues simulation, not mocked), polled by
  // the button itself every 3s until it flips to a download link.
  await page.getByRole("button", { name: /Export everything for my bookkeeper/ }).click();
  const downloadLink = page.getByRole("link", { name: "Download .zip" });
  await expect(downloadLink).toBeVisible({ timeout: 30_000 });

  const href = await downloadLink.getAttribute("href");
  expect(href).toBeTruthy();
  const zipRes = await context.request.get(href!);
  expect(zipRes.status()).toBe(200);
  expect(zipRes.headers()["content-type"]).toContain("application/zip");
  const zipBytes = await zipRes.body();
  // A real zip with the receipt file inside is meaningfully larger than an
  // empty archive (~22 bytes) — not a strict format assertion (that's
  // covered by unit tests of the zip-building code), just proof the
  // download is real content, not an empty/failed placeholder.
  expect(zipBytes.byteLength).toBeGreaterThan(200);
});
