import type { ReminderCadence } from "../contracts/org";

/**
 * The five stages from the plan (T-14/T-7/T-2/day-of/overdue) with overdue
 * split into three distinct values (overdue_1/2/3) — "repeats weekly, max
 * 3" can't be expressed as a single "overdue" stage under
 * reminder_logs' unique(org_id, deadline_id, stage) index (one row per
 * stage, ever), so each weekly repeat is its own stage value instead. That
 * index is exactly what makes cron-replay idempotency free: a second
 * insert for a stage that already fired simply conflicts.
 *
 * "same_day_1900" is different in kind, not degree: it's not computed by
 * `dueReminderStage` from days-until-due at all (see the CADENCE_STAGES
 * table below, which deliberately excludes it) — it only ever fires when a
 * user has explicitly requested it (`deadlines.sameDayReminderRequestedAt`,
 * set by POST /deadlines/:id/remind-tonight, "Remind me at my laptop
 * tonight"). It shares the same reminder_logs uniqueness guarantee: once
 * sent for a given deadline, it can never send again for that deadline.
 */
export type ReminderStage =
  "t14" | "t7" | "t2" | "day" | "overdue_1" | "overdue_2" | "overdue_3" | "same_day_1900";

// Partial, not Record<ReminderStage, ...>: same_day_1900 is deliberately
// excluded — it's never computed from a day-offset (see the type's own
// doc comment above).
const STAGE_OFFSET_DAYS: Partial<Record<ReminderStage, number>> = {
  t14: 14,
  t7: 7,
  t2: 2,
  day: 0,
  overdue_1: -1,
  overdue_2: -8,
  overdue_3: -15,
};

/**
 * Calm (design's lighter option): T-14 and T-2, plus a single overdue
 * notice — never fully silent about a missed legal deadline, even on the
 * quiet setting. Persistent (default, "recommended"): T-14, T-7, day-of,
 * and all three weekly overdue repeats.
 */
const CADENCE_STAGES: Record<ReminderCadence, ReminderStage[]> = {
  calm: ["t14", "t2", "overdue_1"],
  persistent: ["t14", "t7", "day", "overdue_1", "overdue_2", "overdue_3"],
};

/** The stage due today for this deadline under this cadence, or null if none matches exactly. */
export function dueReminderStage(
  daysUntilDue: number,
  cadence: ReminderCadence,
): ReminderStage | null {
  const enabled = CADENCE_STAGES[cadence];
  return enabled.find((stage) => STAGE_OFFSET_DAYS[stage] === daysUntilDue) ?? null;
}
