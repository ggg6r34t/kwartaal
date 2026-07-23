import { daysUntilDue } from "@kwartaal/core";
import type { Quarter } from "@kwartaal/core";
import type { QuarterTimelineState } from "../components/YearTimeline";

function periodStartMonth(q: 1 | 2 | 3 | 4): number {
  return (q - 1) * 3 + 1;
}

/**
 * Presentational categorization only (not tax-legal deadline math, which
 * lives in @kwartaal/core's daysUntilDue) — decides which of the
 * timeline's six visual states a quarter is in right now.
 */
export function quarterTimelineState(
  quarter: Pick<Quarter, "status" | "year" | "q">,
  dueDate: string,
  now: Date,
): { state: QuarterTimelineState; stateLabel: string; daysLeft?: number } {
  if (quarter.status === "handled_elsewhere") {
    return { state: "handledElsewhere", stateLabel: "Handled elsewhere" };
  }
  if (quarter.status === "paid") {
    return { state: "settled", stateLabel: "Settled" };
  }

  const days = daysUntilDue(dueDate, now);
  if (days < 0) return { state: "overdue", stateLabel: "Overdue" };
  if (days <= 14) {
    return {
      state: "dueSoon",
      stateLabel: `${days} day${days === 1 ? "" : "s"}`,
      daysLeft: days,
    };
  }

  const periodStart = `${quarter.year}-${String(periodStartMonth(quarter.q)).padStart(2, "0")}-01`;
  const todayIso = now.toISOString().slice(0, 10);
  if (todayIso < periodStart) return { state: "future", stateLabel: "" };
  return { state: "open", stateLabel: "Open" };
}
