import type { KorProgress } from "./types";

/**
 * KOR turnover is a calendar-year-to-date total (not a true rolling 365-day
 * window) — the design's own framing is "Rolling turnover · calendar year
 * 2026". The warning threshold is 90% (docs/design's onboarding copy is
 * explicit: "cross €18.000 on the KOR and we warn you before the limit
 * does" — €18.000 of a €20.000 limit); crossing 100% means the KOR no
 * longer applies from that invoice onward.
 */
const WARNING_THRESHOLD_BPS = 9000;

export function korRollingTurnover(
  incomeLines: { amountExVatCents: number; date: string }[],
  year: number,
  limitCents: number,
): KorProgress {
  const yearPrefix = `${year}-`;
  const rollingTurnoverCents = incomeLines
    .filter((line) => line.date.startsWith(yearPrefix))
    .reduce((sum, line) => sum + line.amountExVatCents, 0);

  const pctBps =
    limitCents === 0 ? 0 : Math.round((rollingTurnoverCents / limitCents) * 10000);

  return {
    rollingTurnoverCents,
    limitCents,
    pctBps,
    crossedWarningThreshold:
      rollingTurnoverCents >= Math.floor((limitCents * WARNING_THRESHOLD_BPS) / 10000),
    crossedLimit: rollingTurnoverCents >= limitCents,
  };
}
