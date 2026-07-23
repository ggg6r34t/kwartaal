import puppeteer from "@cloudflare/puppeteer";
import { formatCents, type IncomeTaxStudioResponse } from "@kwartaal/core";
import type { schema } from "@kwartaal/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type { Bindings } from "../bindings";

type BusinessProfile = InferSelectModel<typeof schema.businessProfiles>;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );
}

/**
 * The annual income-tax handoff summary — same figures the income tax
 * studio screen shows (one aggregation, two renderers; see
 * lib/income-tax-aggregate.ts). No dedicated print mockup exists in
 * docs/design for this document, so this is a best-effort table rather
 * than a pixel-matched export (see PROGRESS.md).
 */
export function buildBookkeeperSummaryHtml(
  orgName: string,
  profile: BusinessProfile,
  data: IncomeTaxStudioResponse,
): string {
  if (data.figuresPending || !data.waterfall || !data.bracketFills) {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Kwartaal — ${data.year}</title></head>
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1F1B16;padding:32px">
  <h1>${escapeHtml(orgName)} — ${data.year} income tax summary</h1>
  <p>Tax figures for ${data.year} are not yet published — revenue and costs so far are logged, but no estimate can be produced yet.</p>
  <p>Revenue so far: ${formatCents(data.revenueCents)} · Costs so far: ${formatCents(data.costsCents)}</p>
</body></html>`;
  }

  const waterfallRows = data.waterfall
    .map(
      (step) =>
        `<tr><td>${escapeHtml(step.label)}</td><td class="num">${formatCents(step.amountCents)}</td><td class="num">${formatCents(step.runningTotalCents)}</td><td>${step.eligible ? "eligible" : escapeHtml(step.reason ?? "not eligible")}</td></tr>`,
    )
    .join("");

  const bracketRows = data.bracketFills
    .map(
      (fill) =>
        `<tr><td>${(fill.rateBps / 100).toLocaleString("nl-NL")}% up to ${fill.uptoCents === null ? "—" : formatCents(fill.uptoCents)}</td><td class="num">${formatCents(fill.filledCents)}</td><td class="num">${formatCents(fill.taxCents)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Kwartaal handoff — ${data.year}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1F1B16; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin-top: 28px; border-bottom: 1px solid #E5E0D5; padding-bottom: 4px; }
  .meta { color: #7A7266; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #F0EDE5; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total { display: flex; justify-content: space-between; padding: 10px 0; font-size: 15px; font-weight: 600; }
</style></head>
<body>
  <h1>${escapeHtml(orgName)} — ${data.year} income tax summary</h1>
  <div class="meta">Legal form: ${escapeHtml(profile.legalForm)} · Hours logged: ${data.hoursLogged} of ${data.hoursTarget} (${data.meetsUrencriterium ? "urencriterium met" : "urencriterium not yet met"}) · startersaftrek used: ${data.startersaftrekUsedCount} of 3</div>

  <h2>Profit</h2>
  <div class="total"><span>Revenue</span><span>${formatCents(data.revenueCents)}</span></div>
  <div class="total"><span>Costs</span><span>−${formatCents(data.costsCents)}</span></div>
  <div class="total"><span>Profit</span><span>${formatCents(data.profitCents)}</span></div>

  <h2>Deduction stack</h2>
  <table><thead><tr><th>Step</th><th>Amount</th><th>Running total</th><th>Status</th></tr></thead><tbody>${waterfallRows}</tbody></table>
  <div class="total"><span>Taxable income</span><span>${formatCents(data.taxableCents ?? 0)}</span></div>

  <h2>Brackets</h2>
  <table><thead><tr><th>Bracket</th><th>Filled</th><th>Tax</th></tr></thead><tbody>${bracketRows}</tbody></table>
  <div class="total"><span>Zvw-bijdrage</span><span>+${formatCents(data.zvwCents ?? 0)}</span></div>
  <div class="total"><span>Credits</span><span>−${formatCents(data.creditsCents ?? 0)}</span></div>

  <h2>Estimated tax to set aside</h2>
  <div class="total"><span>${data.year}</span><span>${formatCents(data.setAsideCents ?? 0)}</span></div>
</body></html>`;
}

/**
 * Print-to-PDF via Browser Rendering. NOT exercised locally — `wrangler dev`
 * doesn't support the [browser] binding (see wrangler.toml comment); this
 * path is unverified until it runs against a deployed environment, per
 * PROGRESS.md.
 */
export async function renderBookkeeperSummaryPdf(
  env: Bindings,
  html: string,
): Promise<Uint8Array> {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
