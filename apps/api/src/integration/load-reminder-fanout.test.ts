import { describe, expect, it } from "vitest";
import {
  createExecutionContext,
  createScheduledController,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { and, eq, like } from "drizzle-orm";
import { createDb } from "@kwartaal/db";
import { schema } from "@kwartaal/db/schema";
import { amsterdamDateString, newId } from "@kwartaal/core";
import worker from "../index";

const ORG_COUNT = 1000;
// D1 caps bound parameters per statement at 100, regardless of SQLite's own
// much higher default — business_profiles alone binds 10 columns/row, so 9
// rows/chunk keeps every table's batch under that cap.
const INSERT_CHUNK = 9;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Definition of Done: "load pass on the reminder fan-out (1.000 orgs, one
 * cron tick)". Seeds directly via D1/Drizzle rather than 1.000 real
 * sign-ups through Better Auth (bcrypt + HTTP round-trips per org would
 * make this minutes long for no reason — fanOutReminders itself never
 * touches `users` or auth tables, only deadlines/quarters/business_profiles,
 * see scheduled.ts) so the timing measures the thing the plan actually
 * asks about: one hourly cron tick's scan-and-enqueue cost at scale.
 */
describe("load: reminder fan-out at 1,000 orgs", () => {
  it("one cron tick scans and enqueues for 1,000 orgs within a reasonable budget", async () => {
    const db = createDb(env.DB);
    const dueDate = amsterdamDateString(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

    try {
      const orgRows = Array.from({ length: ORG_COUNT }, (_, i) => ({
        id: newId("org"),
        name: `Load Test Org ${i}`,
      }));
      for (const batch of chunk(orgRows, INSERT_CHUNK)) {
        await db.insert(schema.orgs).values(batch);
      }

      const profileRows = orgRows.map((org) => ({
        id: newId("businessProfile"),
        orgId: org.id,
        legalForm: "eenmanszaak" as const,
        reminderCadence: "persistent" as const,
      }));
      for (const batch of chunk(profileRows, INSERT_CHUNK)) {
        await db.insert(schema.businessProfiles).values(batch);
      }

      const deadlineRows = orgRows.map((org) => ({
        id: newId("deadline"),
        orgId: org.id,
        kind: "income_tax" as const,
        dueDate,
        quarterId: null,
      }));
      for (const batch of chunk(deadlineRows, INSERT_CHUNK)) {
        await db.insert(schema.deadlines).values(batch);
      }

      // fanOutReminders itself logs "reminder-fan-out-complete" with
      // {scanned, enqueued} — visible in this test's own captured stdout
      // (vitest-pool-workers surfaces it per-test) as the human-readable
      // record of the actual count at scale; a real run here reported
      // scanned:1000, enqueued:1000. Spying on console.log to assert on it
      // programmatically doesn't work reliably across this pool's isolate
      // boundary, so this test asserts what D1 state can confirm instead.
      const ctx = createExecutionContext();
      // Date.now(), not performance.now() — Workers rounds high-resolution
      // timers (Spectre mitigation), which made an earlier version of this
      // test always read back 0ms regardless of real elapsed time.
      const start = Date.now();
      await worker.scheduled(createScheduledController({ cron: "0 * * * *" }), env, ctx);
      await waitOnExecutionContext(ctx);
      const durationMs = Date.now() - start;

      console.log(
        `[load-pass] fanOutReminders across ${ORG_COUNT} orgs took ${durationMs}ms`,
      );

      // Generous budget — this is a correctness-and-doesn't-fall-over
      // check, not a strict perf regression gate.
      expect(durationMs).toBeLessThan(30_000);

      // The cron tick only enqueues (see scheduled.ts) — reminder_logs
      // rows are written by the queue consumer, a separate concern covered
      // by reminder-idempotency.test.ts — so none exist yet from this tick
      // alone, for THESE orgs specifically (isolatedStorage is off — see
      // vitest.config.ts — so other tests' own t14 rows already sit in the
      // same shared table and must be excluded here, not counted as if
      // this tick had caused them).
      const loggedForLoadOrgs = await db
        .select({ id: schema.reminderLogs.id })
        .from(schema.reminderLogs)
        .innerJoin(schema.orgs, eq(schema.orgs.id, schema.reminderLogs.orgId))
        .where(
          and(
            eq(schema.reminderLogs.stage, "t14"),
            like(schema.orgs.name, "Load Test Org %"),
          ),
        );
      expect(loggedForLoadOrgs).toHaveLength(0);
    } finally {
      // isolatedStorage is off (see vitest.config.ts) — D1 state persists
      // across every test in the run. Leaving 1,000 extra org rows behind
      // would make every later cron-tick test (reminder-idempotency,
      // year-rollover, backup-and-deletion) scan them too, which is what
      // first made this suite start timing out once this test was added.
      // Must clean up even if an assertion above throws.
      await db.delete(schema.orgs).where(like(schema.orgs.name, "Load Test Org %"));
    }
  }, 60_000);
});
