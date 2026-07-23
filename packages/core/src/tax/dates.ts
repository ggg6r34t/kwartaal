/**
 * Europe/Amsterdam calendar-date math. With an hourly cron computing "days
 * until due" from raw UTC millisecond differences, a DST transition
 * (CET↔CEST) shifts the day boundary by an hour and silently produces an
 * off-by-one — this is exactly the bug class the plan calls out by name.
 * The fix: derive "today" as Amsterdam's own calendar date first (via
 * Intl, which knows the correct offset for any instant), then do calendar
 * (not millisecond) arithmetic against the due date.
 */

/** YYYY-MM-DD for the given instant, as observed in Europe/Amsterdam. */
export function amsterdamDateString(instant: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Midnight UTC of the given YYYY-MM-DD calendar date, used only as a neutral instant for day-count subtraction. */
function calendarDateToUtcMidnight(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

/** Whole calendar days from "now" (in Amsterdam) until dueDateIso. Negative when overdue. */
export function daysUntilDue(dueDateIso: string, now: Date): number {
  const todayIso = amsterdamDateString(now);
  const msPerDay = 24 * 60 * 60 * 1000;
  const due = calendarDateToUtcMidnight(dueDateIso);
  const today = calendarDateToUtcMidnight(todayIso);
  return Math.round((due - today) / msPerDay);
}
