import { eq } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
import { createDb, forOrg, type Database, type TenantDb } from "@kwartaal/db";
import { schema } from "@kwartaal/db/schema";
import { authUser } from "@kwartaal/db/auth-schema";
import { newId, type DeadlineKind } from "@kwartaal/core";
import type { Bindings, ExportQueueMessage, ReminderQueueMessage } from "./bindings";
import { logger } from "./lib/logger";
import { audit } from "./lib/audit";
import { deliverReminderEmail } from "./email/deliver-reminder";
import { buildReminderEmail } from "./email/reminder-templates";
import {
  buildBookkeeperSummaryHtml,
  renderBookkeeperSummaryPdf,
} from "./lib/bookkeeper-summary";
import { aggregateIncomeTaxYear } from "./lib/income-tax-aggregate";

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
    } else if (message.body.kind === "export") {
      await handleExportMessage(db, env, message.body);
    }

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

  if (body.stage === "same_day_1900") {
    // Clears the pending indicator now that it's actually been sent — the
    // reminder_logs row above is what prevents a resend, this is just so
    // the UI stops showing "pending" for a request that already fired.
    await tenantDb.update(
      schema.deadlines,
      { sameDayReminderRequestedAt: null },
      eq(schema.deadlines.id, body.deadlineId),
    );
  }

  await audit(tenantDb, {
    actor: owner.id,
    action: "reminder.sent",
    target: body.deadlineId,
    meta: { stage: body.stage },
  });
}

/**
 * The user's own 7-year retention obligation, self-served: everything
 * tenant-scoped as JSON plus the actual receipt files, zipped and dropped in
 * R2. Never built inline in a request handler (async rule) — the route only
 * enqueues; this is where the work happens.
 */
async function handleExportMessage(
  db: Database,
  env: Bindings,
  body: ExportQueueMessage,
): Promise<void> {
  const tenantDb = forOrg(db, body.orgId);

  const [job] = await tenantDb.select(
    schema.exportJobs,
    eq(schema.exportJobs.id, body.exportJobId),
  );
  if (!job) return; // deleted since enqueue; nothing to do

  await tenantDb.update(
    schema.exportJobs,
    { status: "running" },
    eq(schema.exportJobs.id, job.id),
  );

  try {
    const r2Key =
      job.kind === "bookkeeper_summary"
        ? await buildBookkeeperSummaryPdfFile(tenantDb, env, job)
        : await buildExportZip(tenantDb, env, job.id);
    await tenantDb.update(
      schema.exportJobs,
      { status: "completed", r2Key },
      eq(schema.exportJobs.id, job.id),
    );
    await audit(tenantDb, {
      actor: job.requestedBy,
      action: "export-job.completed",
      target: job.id,
    });
  } catch (err) {
    logger.error("export-job-failed", {
      exportJobId: job.id,
      orgId: body.orgId,
      message: err instanceof Error ? err.message : String(err),
    });
    await tenantDb.update(
      schema.exportJobs,
      { status: "failed" },
      eq(schema.exportJobs.id, job.id),
    );
    await audit(tenantDb, {
      actor: job.requestedBy,
      action: "export-job.failed",
      target: job.id,
    });
  }
}

async function buildExportZip(
  tenantDb: TenantDb,
  env: Bindings,
  jobId: string,
): Promise<string> {
  const [
    quarters,
    incomeLines,
    expenseLines,
    depreciationSchedules,
    hoursEntries,
    kmEntries,
    pots,
    setAsideEntries,
    voorlopigeAanslagen,
    receipts,
  ] = await Promise.all([
    tenantDb.select(schema.quarters),
    tenantDb.select(schema.incomeLines),
    tenantDb.select(schema.expenseLines),
    tenantDb.select(schema.depreciationSchedules),
    tenantDb.select(schema.hoursEntries),
    tenantDb.select(schema.kmEntries),
    tenantDb.select(schema.pots),
    tenantDb.select(schema.setAsideEntries),
    tenantDb.select(schema.voorlopigeAanslagen),
    tenantDb.select(schema.receipts),
  ]);

  const files: Record<string, Uint8Array> = {
    "quarters.json": strToU8(JSON.stringify(quarters, null, 2)),
    "income-lines.json": strToU8(JSON.stringify(incomeLines, null, 2)),
    "expense-lines.json": strToU8(JSON.stringify(expenseLines, null, 2)),
    "depreciation-schedules.json": strToU8(
      JSON.stringify(depreciationSchedules, null, 2),
    ),
    "hours-entries.json": strToU8(JSON.stringify(hoursEntries, null, 2)),
    "km-entries.json": strToU8(JSON.stringify(kmEntries, null, 2)),
    "pots.json": strToU8(JSON.stringify(pots, null, 2)),
    "set-aside-entries.json": strToU8(JSON.stringify(setAsideEntries, null, 2)),
    "voorlopige-aanslagen.json": strToU8(JSON.stringify(voorlopigeAanslagen, null, 2)),
    "receipts.json": strToU8(JSON.stringify(receipts, null, 2)),
  };

  for (const receipt of receipts) {
    const object = await env.RECEIPTS.get(receipt.r2Key);
    if (!object) continue; // orphaned row — export the metadata, skip the missing file
    const bytes = new Uint8Array(await object.arrayBuffer());
    const ext = receipt.r2Key.split(".").pop() ?? "bin";
    files[`receipts/${receipt.id}.${ext}`] = bytes;
  }

  const zipped = zipSync(files, { level: 6 });
  const key = `${tenantDb.orgId}/exports/${jobId}.zip`;
  await env.RECEIPTS.put(key, zipped, {
    httpMetadata: { contentType: "application/zip" },
  });
  return key;
}

async function buildBookkeeperSummaryPdfFile(
  tenantDb: TenantDb,
  env: Bindings,
  job: { id: string; year: number | null },
): Promise<string> {
  if (job.year === null) throw new Error("bookkeeper_summary export job missing year");

  const [[profile], org, data] = await Promise.all([
    tenantDb.select(schema.businessProfiles),
    tenantDb.global.query.orgs.findFirst({ where: eq(schema.orgs.id, tenantDb.orgId) }),
    aggregateIncomeTaxYear(tenantDb, job.year),
  ]);
  if (!profile) throw new Error(`business profile missing for org ${tenantDb.orgId}`);

  const html = buildBookkeeperSummaryHtml(org?.name ?? "Kwartaal", profile, data);
  const pdf = await renderBookkeeperSummaryPdf(env, html);
  const key = `${tenantDb.orgId}/summaries/${job.id}.pdf`;
  await env.RECEIPTS.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });
  return key;
}
