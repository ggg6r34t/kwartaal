import { test, expect } from "@playwright/test";
import {
  apiCompleteOnboarding,
  apiGetOrgId,
  apiSignUp,
  d1Execute,
  d1QueryFirst,
} from "./helpers";

/**
 * Plan's primary flow 3: "reminder email fires for a seeded T-7 deadline
 * [time-travel clock]." A live `wrangler dev` process has no equivalent of
 * the vitest-pool-workers harness's `createScheduledController({
 * scheduledTime })` (see year-rollover.test.ts, reminder-idempotency.test.ts
 * for the real time-travel coverage of this logic) — there's no way to
 * make a running dev server believe it's a different date. Instead this
 * seeds a deadline genuinely 7 days from the real current date (so no time
 * travel is needed for it to land on the "t7" stage) and fires the cron
 * via wrangler dev's own `--test-scheduled` local trigger endpoint — a
 * real cron tick, real queue consumer, real D1 write, just anchored to
 * actual wall-clock "today" rather than a simulated one.
 */
test("a deadline due in exactly 7 days gets a t7 reminder logged after one real cron tick", async ({
  context,
}) => {
  const email = `e2e-reminder-${Date.now()}@example.com`;
  await apiSignUp(context, email);
  await apiCompleteOnboarding(context);
  const orgId = await apiGetOrgId(context);

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const deadlineId = `e2e_ddl_${Date.now()}`;
  d1Execute(
    `INSERT INTO deadlines (id, org_id, kind, due_date, quarter_id, dismissed_at, created_at, updated_at) ` +
      `VALUES ('${deadlineId}', '${orgId}', 'income_tax', '${dueDate}', NULL, NULL, unixepoch(), unixepoch())`,
  );

  const triggerRes = await context.request.get(
    "http://localhost:8787/__scheduled?cron=0+*+*+*+*",
  );
  expect(triggerRes.ok()).toBe(true);

  // The consumer processes asynchronously; poll briefly for the row rather
  // than assuming it landed the instant the trigger request returned.
  let logged: { stage: string } | null = null;
  for (let attempt = 0; attempt < 10 && !logged; attempt++) {
    logged = d1QueryFirst<{ stage: string }>(
      `SELECT stage FROM reminder_logs WHERE deadline_id = '${deadlineId}'`,
    );
    if (!logged) await new Promise((r) => setTimeout(r, 1000));
  }

  expect(logged?.stage).toBe("t7");
});
