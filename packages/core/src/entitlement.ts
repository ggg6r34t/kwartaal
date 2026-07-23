/**
 * First-quarter-free event-boxed trial (locked decision #5).
 * The trial ends when the first drawer closes (filed + paid on an
 * in_progress quarter sets BusinessProfile.firstQuarterClosedAt), never on a
 * calendar date. It is set once and never cleared, so a lapsed/canceled
 * subscription after the gate drops does NOT resurrect the trial.
 */
export interface EntitlementInput {
  activeSubscription: boolean;
  firstQuarterClosedAt: string | null;
}

export function hasProAccess(input: EntitlementInput): boolean {
  return input.activeSubscription || input.firstQuarterClosedAt === null;
}
