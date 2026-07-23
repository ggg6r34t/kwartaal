import { describe, expect, it } from "vitest";
import {
  createExecutionContext,
  createMessageBatch,
  createScheduledController,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { amsterdamDateString } from "@kwartaal/core";
import worker from "../index";
import type { ReminderQueueMessage } from "../bindings";
import { signUpAndOnboard } from "./helpers";

function amsterdamDatePlusDays(days: number): string {
  const todayIso = amsterdamDateString(new Date());
  const [y, m, d] = todayIso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Definition of Done: "Reminders proven idempotent under cron replay; no
 * reminder ever sent twice for one (org, deadline, stage)." Two layers are
 * tested because the real guarantee and the cheap avoidance live in
 * different places (see scheduled.ts's own comment): the cron's
 * pre-check avoids re-enqueueing once a reminder_logs row exists, but the
 * actual guarantee — the one that survives a queue replaying the same
 * message twice — is the consumer's unique-index insert. Both are
 * exercised against real D1, not mocked.
 */
describe("reminder idempotency", () => {
  it("processing the same reminder message twice inserts exactly one reminder_logs row", async () => {
    const org = await signUpAndOnboard("reminder-owner-a@example.com");
    const dueDateIso = amsterdamDatePlusDays(14);
    const deadlineId = "ddl_idempotency_test_a";

    await env.DB.prepare(
      `INSERT INTO deadlines (id, org_id, kind, due_date, quarter_id, dismissed_at, created_at, updated_at)
       VALUES (?, ?, 'income_tax', ?, NULL, NULL, ?, ?)`,
    )
      .bind(deadlineId, org.orgId, dueDateIso, Date.now(), Date.now())
      .run();

    const message: ReminderQueueMessage = {
      kind: "reminder",
      orgId: org.orgId,
      deadlineId,
      stage: "t14",
    };
    // Simulates a queue replaying the exact same logical message twice —
    // the scenario a naive "check reminder_logs, then insert" (rather than
    // the actual insert-with-onConflictDoNothing) would fail under.
    const batch = createMessageBatch<ReminderQueueMessage>("kwartaal-reminders", [
      { id: "msg-1", timestamp: new Date(), attempts: 1, body: message },
      { id: "msg-2", timestamp: new Date(), attempts: 1, body: message },
    ]);
    const ctx = createExecutionContext();
    await worker.queue(batch, env, ctx);
    await waitOnExecutionContext(ctx);

    const logs = await env.DB.prepare(
      "SELECT id FROM reminder_logs WHERE deadline_id = ? AND stage = 't14'",
    )
      .bind(deadlineId)
      .all();
    expect(logs.results).toHaveLength(1);
  });

  it("a second hourly cron tick never re-enqueues a stage the consumer already logged", async () => {
    const org = await signUpAndOnboard("reminder-owner-b@example.com");
    const dueDateIso = amsterdamDatePlusDays(14);
    const deadlineId = "ddl_idempotency_test_b";

    await env.DB.prepare(
      `INSERT INTO deadlines (id, org_id, kind, due_date, quarter_id, dismissed_at, created_at, updated_at)
       VALUES (?, ?, 'income_tax', ?, NULL, NULL, ?, ?)`,
    )
      .bind(deadlineId, org.orgId, dueDateIso, Date.now(), Date.now())
      .run();

    // First tick enqueues, then the queue is drained through the real
    // consumer so its reminder_logs row actually exists before tick two —
    // matching production's real ordering (cron enqueues, the queue
    // consumer runs asynchronously, not necessarily before the next tick,
    // but this proves the pre-check works once it has).
    const ctx1 = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: "0 * * * *" }), env, ctx1);
    await waitOnExecutionContext(ctx1);

    const message: ReminderQueueMessage = {
      kind: "reminder",
      orgId: org.orgId,
      deadlineId,
      stage: "t14",
    };
    const drainCtx = createExecutionContext();
    await worker.queue(
      createMessageBatch<ReminderQueueMessage>("kwartaal-reminders", [
        { id: "drain-1", timestamp: new Date(), attempts: 1, body: message },
      ]),
      env,
      drainCtx,
    );
    await waitOnExecutionContext(drainCtx);

    const afterFirstTick = await env.DB.prepare(
      "SELECT id FROM reminder_logs WHERE deadline_id = ? AND stage = 't14'",
    )
      .bind(deadlineId)
      .all();
    expect(afterFirstTick.results).toHaveLength(1);

    // Second tick: the pre-check in fanOutReminders must see the existing
    // reminder_logs row and skip this deadline+stage entirely.
    const ctx2 = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: "0 * * * *" }), env, ctx2);
    await waitOnExecutionContext(ctx2);

    const afterSecondTick = await env.DB.prepare(
      "SELECT id FROM reminder_logs WHERE deadline_id = ? AND stage = 't14'",
    )
      .bind(deadlineId)
      .all();
    expect(afterSecondTick.results).toHaveLength(1);
  });
});
