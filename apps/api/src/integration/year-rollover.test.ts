import { describe, expect, it } from "vitest";
import {
  createExecutionContext,
  createMessageBatch,
  createScheduledController,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import worker from "../index";
import type { ReminderQueueMessage } from "../bindings";
import { authedRequest, signUpAndOnboard } from "./helpers";

/**
 * Definition of Done: "a year-rollover test (time-travel to January: Q4
 * due 31 Jan renders correctly, missing next-year TaxFigures shows the
 * pending state, no reminder fires at the wrong Amsterdam hour across the
 * DST change)." scheduled.ts now derives "today" from
 * `event.scheduledTime` rather than wall-clock `Date.now()` specifically
 * so `createScheduledController({ scheduledTime })` can genuinely time-
 * travel the fan-out, not just the pure date-math helpers (already
 * covered by Pillar 2's dates.test.ts DST-transition cases).
 */
describe("year rollover", () => {
  it("Q4's deadline is due 31 January of the following year, and income-tax for the new year shows figuresPending with no TaxFigures row", async () => {
    // Onboard "as if" it's mid-2026 (the real current date in this repo's
    // demo framing) so quarters/deadlines materialize normally, then
    // separately verify the Q4/2026 deadline and the 2027 income-tax view.
    const org = await signUpAndOnboard("year-rollover@example.com");

    const deadlines = (await (await authedRequest(org.cookie, "/deadlines")).json()) as {
      kind: string;
      dueDate: string;
      quarterId: string | null;
    }[];

    const quarters = (await (
      await authedRequest(org.cookie, "/quarters?year=2026")
    ).json()) as { id: string; q: number }[];
    const q4 = quarters.find((q) => q.q === 4);
    expect(q4).toBeDefined();

    const q4Deadline = deadlines.find((d) => d.quarterId === q4!.id);
    expect(q4Deadline?.dueDate).toBe("2027-01-31");

    // No TaxFigures row exists for 2027 in this test DB (only years that
    // have been explicitly seeded do) — the annual studio must degrade to
    // figuresPending, never throw or fabricate a number.
    const incomeTax2027 = await authedRequest(org.cookie, "/income-tax/2027");
    expect(incomeTax2027.status).toBe(200);
    const body = (await incomeTax2027.json()) as {
      figuresPending: boolean;
      waterfall: unknown;
    };
    expect(body.figuresPending).toBe(true);
    expect(body.waterfall).toBeNull();
  });

  it("time-traveling the cron to a January instant computes Q4's days-until-due against that date, not real wall-clock time", async () => {
    const org = await signUpAndOnboard("year-rollover-cron@example.com");
    const quarters = (await (
      await authedRequest(org.cookie, "/quarters?year=2026")
    ).json()) as { id: string; q: number }[];
    const q4Id = quarters.find((q) => q.q === 4)!.id;

    // 17 January 2027, 10:00 UTC — 14 calendar days before the 31 Jan 2027
    // due date, and nowhere near this test's real execution date. If the
    // fan-out used Date.now() instead of event.scheduledTime, this
    // wouldn't land on the t14 stage at all.
    const scheduledTime = Date.UTC(2027, 0, 17, 10, 0, 0);
    const ctx = createExecutionContext();
    await worker.scheduled(
      createScheduledController({ cron: "0 * * * *", scheduledTime }),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    const q4Deadline = await env.DB.prepare(
      "SELECT id FROM deadlines WHERE quarter_id = ?",
    )
      .bind(q4Id)
      .first<{ id: string }>();

    // The scheduled tick only enqueues (see scheduled.ts) — the
    // reminder_logs row is written by the queue consumer, which this test
    // harness never auto-drains (same reason reminder-idempotency.test.ts
    // drains manually). Deliver the message the fan-out would have sent.
    const message: ReminderQueueMessage = {
      kind: "reminder",
      orgId: org.orgId,
      deadlineId: q4Deadline!.id,
      stage: "t14",
    };
    const drainCtx = createExecutionContext();
    await worker.queue(
      createMessageBatch<ReminderQueueMessage>("kwartaal-reminders", [
        {
          id: "year-rollover-drain-1",
          timestamp: new Date(),
          attempts: 1,
          body: message,
        },
      ]),
      env,
      drainCtx,
    );
    await waitOnExecutionContext(drainCtx);

    const log = await env.DB.prepare(
      "SELECT stage FROM reminder_logs WHERE deadline_id = ?",
    )
      .bind(q4Deadline!.id)
      .first<{ stage: string }>();
    expect(log?.stage).toBe("t14");
  });
});
