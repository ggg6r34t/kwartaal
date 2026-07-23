import { eq } from "drizzle-orm";
import { createDb, forOrg, type Database } from "@kwartaal/db";
import { schema } from "@kwartaal/db/schema";
import { authUser } from "@kwartaal/db/auth-schema";
import { newId, type DeadlineKind } from "@kwartaal/core";
import type { Bindings, ExportQueueMessage, ReminderQueueMessage } from "./bindings";
import { logger } from "./lib/logger";
import { audit } from "./lib/audit";
import { deliverReminderEmail } from "./email/deliver-reminder";
import { buildReminderEmail } from "./email/reminder-templates";

/**
 * Both queues share this handler; batch.queue tells you which.
 */
export async function handleQueue(
  batch: MessageBatch<ReminderQueueMessage | ExportQueueMessage>,
  env: Bindings,
  _ctx: ExecutionContext,
): Promise<void> {
  const db = createDb(env.DB);

  for (const message of batch.messages) {
    logger.info("queue-message-received", {
      queue: batch.queue,
      kind: message.body.kind,
    });

    if (message.body.kind === "reminder") {
      await handleReminderMessage(db, env, message.body);
    }
    // Pillar 4 implements the export consumer (build the zip/PDF, write to
    // R2, update ExportJob status).

    message.ack();
  }
}

/**
 * Idempotent by construction: the reminder_logs unique(org_id, deadline_id,
 * stage) index is the real guarantee (the cron's pre-check in scheduled.ts
 * is just cheap avoidance) — inserting the log row happens BEFORE sending
 * the email, and a conflict there means the email never goes out a second
 * time even if this message is somehow delivered twice.
 */
async function handleReminderMessage(
  db: Database,
  env: Bindings,
  body: ReminderQueueMessage,
): Promise<void> {
  const tenantDb = forOrg(db, body.orgId);

  const [deadline] = await tenantDb.select(
    schema.deadlines,
    eq(schema.deadlines.id, body.deadlineId),
  );
  if (!deadline) return; // deleted since enqueue; nothing to do

  const [owner] = await tenantDb.select(schema.users, eq(schema.users.role, "owner"));
  if (!owner) return; // no owner membership to notify — shouldn't happen

  const inserted = await tenantDb
    .insert(schema.reminderLogs, {
      id: newId("reminderLog"),
      deadlineId: body.deadlineId,
      stage: body.stage,
    })
    .onConflictDoNothing({
      target: [
        schema.reminderLogs.orgId,
        schema.reminderLogs.deadlineId,
        schema.reminderLogs.stage,
      ],
    })
    .returning({ id: schema.reminderLogs.id });

  if (inserted.length === 0) {
    logger.info("reminder-already-sent-skipping", {
      deadlineId: body.deadlineId,
      stage: body.stage,
    });
    return;
  }

  let quarterNumber: 1 | 2 | 3 | 4 | undefined;
  if (deadline.quarterId) {
    const [quarter] = await tenantDb.select(
      schema.quarters,
      eq(schema.quarters.id, deadline.quarterId),
    );
    quarterNumber = quarter?.q as 1 | 2 | 3 | 4 | undefined;
  }

  const [authRow] = await db
    .select({ email: authUser.email })
    .from(authUser)
    .where(eq(authUser.id, owner.authUserId));

  const email = buildReminderEmail({
    stage: body.stage,
    deadlineKind: deadline.kind as DeadlineKind,
    dueDate: deadline.dueDate,
    quarter: quarterNumber,
    appUrl: env.APP_ORIGIN,
  });

  if (authRow) {
    await deliverReminderEmail(env, authRow.email, email.subject, email.html, email.text);
  }

  await audit(tenantDb, {
    actor: owner.id,
    action: "reminder.sent",
    target: body.deadlineId,
    meta: { stage: body.stage },
  });
}
