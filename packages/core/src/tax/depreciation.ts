import type { DepreciationYearEntry } from "./types";

const MAX_ANNUAL_RATE_BPS = 2000; // 20%/year cap on the acquisition cost

/**
 * Straight-line depreciation capped at 20%/year of cost, with a partial
 * first year prorated by the months remaining (inclusive of startMonth).
 * `year` in each entry is 1-indexed and relative to the start (year 1 =
 * the year depreciation begins), matching the plan's literal signature
 * (no startYear parameter) — the caller maps offsets to calendar years
 * using the associated expense line's date.
 */
export function buildDepreciationSchedule(
  costCents: number,
  years: number,
  residualCents: number,
  startMonth: number,
): DepreciationYearEntry[] {
  const depreciableCents = Math.max(costCents - residualCents, 0);
  if (depreciableCents === 0 || years <= 0) return [];

  const maxAnnualCents = Math.round((costCents * MAX_ANNUAL_RATE_BPS) / 10000);
  const straightLineAnnualCents = Math.round(depreciableCents / years);
  const annualCents = Math.max(Math.min(straightLineAnnualCents, maxAnnualCents), 0);
  if (annualCents === 0) return [];

  const firstYearMonths = 13 - startMonth; // startMonth 1..12 -> 12..1 months remaining

  const entries: DepreciationYearEntry[] = [];
  let remaining = depreciableCents;
  let relativeYear = 1;

  while (remaining > 0) {
    const monthsThisYear = relativeYear === 1 ? firstYearMonths : 12;
    const proratedCents =
      relativeYear === 1 ? Math.round((annualCents * monthsThisYear) / 12) : annualCents;
    // The final entry takes whatever remains, never its own independent
    // rounding, so the schedule always sums to exactly depreciableCents.
    const amountCents = Math.min(proratedCents, remaining);
    entries.push({ year: relativeYear, month: monthsThisYear, amountCents });
    remaining -= amountCents;
    relativeYear += 1;
  }

  return entries;
}
