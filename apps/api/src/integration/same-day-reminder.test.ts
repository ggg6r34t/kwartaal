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
import { authedRequest, signUpAndOnboard } from "./helpers";

function amsterdamDatePlusDays(days: number): string {
  const todayIso = amsterdamDateString(new Date());
  const [y, m, d] = todayIso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 20:00 UTC is always >= 19:00 in Europe/Amsterdam (UTC+1 or UTC+2), year-round. */
function todayAt20UTC(): Date {
  const iso = amsterdamDateString(new Date());
  return new Date(`${iso}T20:00:00.000Z`);
}

/** 10:00 UTC is always well before 19:00 in Europe/Amsterdam. */
function todayAt10UTC(): Date {
  const iso = amsterdamDateString(new Date());
  return new Date(`${iso}T10:00:00.000Z`);
}

async function insertDeadline(orgId: string, id: string, dueDateIso: string) {
  await env.DB.prepare(
    `INSERT INTO deadlines (id, org_id, kind, due_date, quarter_id, dismissed_at, same_day_reminder_requested_at, created_at, updated_at)
     VALUES (?, ?, 'income_tax', ?, NULL, NULL, NULL, ?, ?)`,
  )
    .bind(id, orgId, dueDateIso, Date.now(), Date.now())
    .run();
}

/**
 * "Verify the handoff reminder exists end to end (persisted, delivered via
 * the reminder pipeline, deep-links the checklist) — not just the
 * button." Real requests through the real Hono app, a real hourly cron
 * tick (time-traveled before and after 19:00 Amsterdam), and the real
 * queue consumer — nothing mocked.
 */
describe('same-day handoff reminder ("remind me at my laptop tonight")', () => {
  it("POST sets the flag, GET reflects it, DELETE (undo) clears it", async () => {
    const org = await signUpAndOnboard("handoff-owner-a@example.com");
    const deadlineId = "ddl_handoff_test_a";
    await insertDeadline(org.orgId, deadlineId, amsterdamDatePlusDays(9));

    const setRes = await authedRequest(
      org.cookie,
      `/deadlines/${deadlineId}/remind-tonight`,
      { method: "POST" },
    );
    expect(setRes.status).toBe(200);

    const afterSet = await authedRequest(org.cookie, "/deadlines");
    const afterSetBody = (await afterSet.json()) as {
      id: string;
      sameDayReminderRequestedAt: number | null;
    }[];
    const row = afterSetBody.find((d) => d.id === deadlineId);
    expect(row?.sameDayReminderRequestedAt).not.toBeNull();

    const undoRes = await authedRequest(
      org.cookie,
      `/deadlines/${deadlineId}/remind-tonight`,
      { method: "DELETE" },
    );
    expect(undoRes.status).toBe(204);

    const afterUndo = await authedRequest(org.cookie, "/deadlines");
    const afterUndoBody = (await afterUndo.json()) as {
      id: string;
      sameDayReminderRequestedAt: number | null;
    }[];
    expect(
      afterUndoBody.find((d) => d.id === deadlineId)?.sameDayReminderRequestedAt,
    ).toBeNull();
  });

  it("does not fire before 19:00 Amsterdam, fires exactly once at/after 19:00, and clears the flag", async () => {
    const org = await signUpAndOnboard("handoff-owner-b@example.com");
    const deadlineId = "ddl_handoff_test_b";
    await insertDeadline(org.orgId, deadlineId, amsterdamDatePlusDays(9));

    await authedRequest(org.cookie, `/deadlines/${deadlineId}/remind-tonight`, {
      method: "POST",
    });

    // Tick before 19:00 — must not enqueue anything for this deadline.
    const earlyCtx = createExecutionContext();
    await worker.scheduled(
      createScheduledController({
        cron: "0 * * * *",
        scheduledTime: todayAt10UTC().getTime(),
      }),
      env,
      earlyCtx,
    );
    await waitOnExecutionContext(earlyCtx);

    const beforeEvening = await env.DB.prepare(
      "SELECT id FROM reminder_logs WHERE deadline_id = ? AND stage = 'same_day_1900'",
    )
      .bind(deadlineId)
      .all();
    expect(beforeEvening.results).toHaveLength(0);

    // Tick at/after 19:00 — enqueues; drain the queue through the real consumer.
    const eveningCtx = createExecutionContext();
    await worker.scheduled(
      createScheduledController({
        cron: "0 * * * *",
        scheduledTime: todayAt20UTC().getTime(),
      }),
      env,
      eveningCtx,
    );
    await waitOnExecutionContext(eveningCtx);

    const message: ReminderQueueMessage = {
      kind: "reminder",
      orgId: org.orgId,
      deadlineId,
      stage: "same_day_1900",
    };
    const drainCtx = createExecutionContext();
    await worker.queue(
      createMessageBatch<ReminderQueueMessage>("kwartaal-reminders", [
        { id: "handoff-drain-1", timestamp: new Date(), attempts: 1, body: message },
      ]),
      env,
      drainCtx,
    );
    await waitOnExecutionContext(drainCtx);

    const afterEvening = await env.DB.prepare(
      "SELECT id FROM reminder_logs WHERE deadline_id = ? AND stage = 'same_day_1900'",
    )
      .bind(deadlineId)
      .all();
    expect(afterEvening.results).toHaveLength(1);

    // The flag clears once actually sent — the UI shouldn't keep showing "pending" forever.
    const deadlineRow = await env.DB.prepare(
      "SELECT same_day_reminder_requested_at FROM deadlines WHERE id = ?",
    )
      .bind(deadlineId)
      .first<{ same_day_reminder_requested_at: number | null }>();
    expect(deadlineRow?.same_day_reminder_requested_at).toBeNull();

    // A second evening tick must never re-enqueue (flag is already clear, and
    // even if it weren't, reminder_logs' unique index would still block it).
    const secondEveningCtx = createExecutionContext();
    await worker.scheduled(
      createScheduledController({
        cron: "0 * * * *",
        scheduledTime: todayAt20UTC().getTime(),
      }),
      env,
      secondEveningCtx,
    );
    await waitOnExecutionContext(secondEveningCtx);
    const stillOne = await env.DB.prepare(
      "SELECT id FROM reminder_logs WHERE deadline_id = ? AND stage = 'same_day_1900'",
    )
      .bind(deadlineId)
      .all();
    expect(stillOne.results).toHaveLength(1);
  });

  it("never fires for a deadline where it was never requested", async () => {
    const org = await signUpAndOnboard("handoff-owner-c@example.com");
    const deadlineId = "ddl_handoff_test_c";
    await insertDeadline(org.orgId, deadlineId, amsterdamDatePlusDays(9));
    // No POST /remind-tonight for this one.

    const ctx = createExecutionContext();
    await worker.scheduled(
      createScheduledController({
        cron: "0 * * * *",
        scheduledTime: todayAt20UTC().getTime(),
      }),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    const logs = await env.DB.prepare(
      "SELECT id FROM reminder_logs WHERE deadline_id = ? AND stage = 'same_day_1900'",
    )
      .bind(deadlineId)
      .all();
    expect(logs.results).toHaveLength(0);
  });
});
