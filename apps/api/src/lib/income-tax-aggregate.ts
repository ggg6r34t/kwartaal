import { eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import type { TenantDb } from "@kwartaal/db";
import {
  computeWaterfall,
  estimateIncomeTax,
  incomeTaxStudioResponseSchema,
  type IncomeTaxStudioResponse,
  type TaxFigures,
} from "@kwartaal/core";

const URENCRITERIUM_HOURS = 1225;

/**
 * Shared by GET /income-tax/:year and the bookkeeper-summary PDF builder —
 * one aggregation, two renderers (JSON for the screen, HTML→PDF for the
 * handoff), so the two never drift.
 */
export async function aggregateIncomeTaxYear(
  tenantDb: TenantDb,
  year: number,
): Promise<IncomeTaxStudioResponse> {
  const [profile] = await tenantDb.select(schema.businessProfiles);
  if (!profile) throw new Error("business-profile-not-found");

  const quarterRows = await tenantDb.select(
    schema.quarters,
    eq(schema.quarters.year, year),
  );

  let revenueCents = 0;
  let costsCents = 0;
  for (const quarter of quarterRows) {
    const incomeRows = await tenantDb.select(
      schema.incomeLines,
      eq(schema.incomeLines.quarterId, quarter.id),
    );
    revenueCents += incomeRows.reduce((sum, line) => sum + line.amountExVatCents, 0);
    const expenseRows = await tenantDb.select(
      schema.expenseLines,
      eq(schema.expenseLines.quarterId, quarter.id),
    );
    costsCents += expenseRows.reduce((sum, line) => sum + line.amountExVatCents, 0);
  }
  const profitCents = revenueCents - costsCents;

  const hoursRows = await tenantDb.select(schema.hoursEntries);
  const yearPrefix = `${year}-`;
  const hoursLogged = hoursRows
    .filter((entry) => entry.date.startsWith(yearPrefix))
    .reduce((sum, entry) => sum + entry.hours, 0);

  const [taxYearProfile] = await tenantDb.select(
    schema.taxYearProfiles,
    eq(schema.taxYearProfiles.year, year),
  );
  const hoursTarget = taxYearProfile?.hoursTarget ?? URENCRITERIUM_HOURS;

  const [figuresRow] = await tenantDb.global
    .select()
    .from(schema.taxFigures)
    .where(eq(schema.taxFigures.year, year));

  const base = {
    year,
    revenueCents,
    costsCents,
    profitCents,
    hoursLogged,
    hoursTarget,
    meetsUrencriterium: hoursLogged >= URENCRITERIUM_HOURS,
    startersaftrekUsedCount: profile.startersaftrekUsedCount,
  };

  if (!figuresRow) {
    const response: IncomeTaxStudioResponse = {
      ...base,
      figuresPending: true,
      waterfall: null,
      taxableCents: null,
      bracketFills: null,
      zvwCents: null,
      creditsCents: null,
      setAsideCents: null,
    };
    return incomeTaxStudioResponseSchema.parse(response);
  }

  const figures: TaxFigures = {
    year: figuresRow.year,
    brackets: figuresRow.bracketsJson,
    zelfstandigenaftrekCents: figuresRow.zelfstandigenaftrekCents,
    startersaftrekCents: figuresRow.startersaftrekCents,
    mkbVrijstellingBps: figuresRow.mkbVrijstellingBps,
    zvwBps: figuresRow.zvwBps,
    korLimitCents: figuresRow.korLimitCents,
    algemeneHeffingskortingMaxCents: figuresRow.algemeneHeffingskortingMaxCents,
    arbeidskortingTable: figuresRow.arbeidskortingTableJson,
  };

  const waterfall = computeWaterfall(
    {
      profitCents,
      hoursLogged,
      startersaftrekUsedCount: profile.startersaftrekUsedCount,
      kvkRegisteredAt: profile.kvkRegisteredAt,
      asOfYear: year,
    },
    figures,
  );
  const taxableCents = waterfall[waterfall.length - 1]!.runningTotalCents;
  const estimate = estimateIncomeTax(taxableCents, figures);

  const response: IncomeTaxStudioResponse = {
    ...base,
    figuresPending: false,
    waterfall,
    taxableCents,
    bracketFills: estimate.bracketFills.map((fill) => ({
      uptoCents: fill.bracket.uptoCents,
      rateBps: fill.bracket.rateBps,
      filledCents: fill.filledCents,
      taxCents: fill.taxCents,
    })),
    zvwCents: estimate.zvwCents,
    creditsCents: estimate.creditsCents,
    setAsideCents: estimate.setAsideCents,
  };

  return incomeTaxStudioResponseSchema.parse(response);
}
