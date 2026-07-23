import { describe, expect, it } from "vitest";
import type { IncomeTaxStudioResponse } from "@kwartaal/core";
import { buildBookkeeperSummaryHtml } from "./bookkeeper-summary";

const profile = {
  id: "bprf_1",
  orgId: "org_1",
  legalForm: "eenmanszaak",
  kvkRegisteredAt: null,
  korOptIn: false,
  korSince: null,
  hasSalariedJob: false,
  startersaftrekUsedCount: 1,
  defaultSetAsideRateBps: 3000,
  reminderCadence: "persistent",
  onboardedAt: new Date(),
  firstQuarterClosedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as never;

const resolved: IncomeTaxStudioResponse = {
  year: 2026,
  figuresPending: false,
  revenueCents: 7200000,
  costsCents: 950000,
  profitCents: 6250000,
  hoursLogged: 1084,
  hoursTarget: 1225,
  meetsUrencriterium: false,
  startersaftrekUsedCount: 1,
  waterfall: [
    {
      label: "Zelfstandigenaftrek",
      amountCents: 120000,
      runningTotalCents: 6130000,
      eligible: true,
    },
  ],
  taxableCents: 5166152,
  bracketFills: [
    { uptoCents: 3844100, rateBps: 3582, filledCents: 3844100, taxCents: 1377216 },
  ],
  zvwCents: 250600,
  creditsCents: 585000,
  setAsideCents: 1535600,
};

const pending: IncomeTaxStudioResponse = {
  year: 2027,
  figuresPending: true,
  revenueCents: 1000000,
  costsCents: 200000,
  profitCents: 800000,
  hoursLogged: 214,
  hoursTarget: 1225,
  meetsUrencriterium: false,
  startersaftrekUsedCount: 0,
  waterfall: null,
  taxableCents: null,
  bracketFills: null,
  zvwCents: null,
  creditsCents: null,
  setAsideCents: null,
};

describe("buildBookkeeperSummaryHtml", () => {
  it("renders the resolved figures with formatted amounts", () => {
    const html = buildBookkeeperSummaryHtml("Maya's Studio", profile, resolved);
    expect(html).toContain("Maya&#39;s Studio");
    expect(html).toContain("Zelfstandigenaftrek");
    expect(html).toContain("2026");
  });

  it("renders a pending placeholder when figures aren't published yet", () => {
    const html = buildBookkeeperSummaryHtml("Maya's Studio", profile, pending);
    expect(html).toContain("not yet published");
    expect(html).not.toContain("Zelfstandigenaftrek");
  });

  it("escapes HTML in the org name so it can't inject markup into the PDF", () => {
    const html = buildBookkeeperSummaryHtml(
      "<script>alert(1)</script>",
      profile,
      resolved,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
