import type { KorProgress } from "./types";

/**
 * KOR turnover is a calendar-year-to-date total (not a true rolling 365-day
 * window) — the design's own framing is "Rolling turnover · calendar year
 * 2026". Crossing 80% is a warning point (the app flags it); crossing 100%
 * means the KOR no longer applies from that invoice onward.
 */
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
    crossedWarningThreshold: rollingTurnoverCents >= Math.floor(limitCents * 0.8),
    crossedLimit: rollingTurnoverCents >= limitCents,
  };
}
