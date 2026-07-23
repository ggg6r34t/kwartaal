import { eq } from "drizzle-orm";
import { createDb } from "@kwartaal/db";
import { schema } from "@kwartaal/db/schema";
import { daysUntilDue, dueReminderStage, type ReminderCadence } from "@kwartaal/core";
import type { Bindings, ReminderQueueMessage } from "./bindings";
import { logger } from "./lib/logger";
import { runWeeklyBackup, sweepExpiredDeletions } from "./lib/backup";

/**
 * Two crons share this handler (see wrangler.toml [triggers]), dispatched
 * on event.cron:
 *   - "0 * * * *"  hourly reminder fan-out — the product's heartbeat.
 *   - "0 3 * * 7"  weekly logical D1 backup export to the BACKUPS bucket
 *     (8 weekly retained), bundled with the 30-day hard-cascade-delete
 *     sweep for expired deletion requests (same cron surface, per Pillar
 *     5's own note — both are low-frequency housekeeping).
 */
export async function handleScheduled(
  event: ScheduledController,
  env: Bindings,
  ctx: ExecutionContext,
): Promise<void> {
  logger.info("scheduled-trigger-fired", { cron: event.cron });

  if (event.cron === "0 * * * *") {
    // event.scheduledTime (not wall-clock Date.now()) so a test harness's
    // "time-travel" — overriding scheduledTime via createScheduledController
    // — genuinely drives the fan-out's notion of "today," the same
    // mechanism the plan's year-rollover/DST test relies on by name.
    ctx.waitUntil(fanOutReminders(env, new Date(event.scheduledTime)));
    return;
  }

  if (event.cron === "0 3 * * 7") {
    // Sequential, not two parallel waitUntils: the backup should capture a
    // pre-sweep snapshot (so a just-expired org's final state is still in
    // that week's backup), and serializing the two avoids both touching D1
    // concurrently.
    ctx.waitUntil(runWeeklyMaintenance(env, new Date(event.scheduledTime)));
    return;
  }
}

async function runWeeklyMaintenance(env: Bindings, now: Date): Promise<void> {
  await runWeeklyBackup(env);
  await sweepExpiredDeletions(env, now);
}

/**
 * `.global` fan-out across every org's deadlines (the sanctioned escape
 * hatch — a cron tick has no single org to scope to). Amsterdam calendar
 * date drives "days until due" (see @kwartaal/core's daysUntilDue) so an
 * hourly tick never off-by-ones across a DST transition. Enqueueing is
 * check-then-send, but the real idempotency guarantee is the consumer's
 * `reminder_logs` unique-index insert (see queue.ts) — this check is just
 * cheap avoidance of enqueueing work that would be a no-op anyway.
 *
 * Not yet optimized for scale (queries every deadline row every tick) —
 * the plan's 1.000-org load pass is an explicit Pillar 6 gate, not this
 * pillar's.
 */
async function fanOutReminders(env: Bindings, now: Date): Promise<void> {
  const db = createDb(env.DB);

  const rows = await db
    .select({
      deadlineId: schema.deadlines.id,
      orgId: schema.deadlines.orgId,
      dueDate: schema.deadlines.dueDate,
      dismissedAt: schema.deadlines.dismissedAt,
      quarterStatus: schema.quarters.status,
      cadence: schema.businessProfiles.reminderCadence,
    })
    .from(schema.deadlines)
    .leftJoin(schema.quarters, eq(schema.deadlines.quarterId, schema.quarters.id))
    .innerJoin(
      schema.businessProfiles,
      eq(schema.businessProfiles.orgId, schema.deadlines.orgId),
    );

  let enqueued = 0;

  for (const row of rows) {
    if (row.dismissedAt) continue;
    // A quarter already handled (elsewhere, or filed+paid here) needs no more nudging.
    if (row.quarterStatus === "handled_elsewhere" || row.quarterStatus === "paid")
      continue;

    const days = daysUntilDue(row.dueDate, now);
    const stage = dueReminderStage(days, row.cadence as ReminderCadence);
    if (!stage) continue;

    const existing = await db.query.reminderLogs.findFirst({
      where: (logs, { and, eq: eqOp }) =>
        and(eqOp(logs.deadlineId, row.deadlineId), eqOp(logs.stage, stage)),
    });
    if (existing) continue;

    const message: ReminderQueueMessage = {
      kind: "reminder",
      orgId: row.orgId,
      deadlineId: row.deadlineId,
      stage,
    };
    await env.REMINDER_QUEUE.send(message);
    enqueued += 1;
  }

  logger.info("reminder-fan-out-complete", { scanned: rows.length, enqueued });
}
