import type { Bindings } from "./bindings";
import { logger } from "./lib/logger";

/**
 * Two crons share this handler (see wrangler.toml [triggers]), dispatched
 * on event.cron:
 *   - "0 * * * *"  hourly reminder fan-out — the product's heartbeat.
 *     Pillar 3 implements: upsert Deadline rows from the engine for every
 *     active org (.global fan-out), select due reminder stages not yet in
 *     ReminderLog, enqueue REMINDER_QUEUE messages.
 *   - "0 3 * * 0"  weekly logical D1 backup export to the BACKUPS bucket
 *     (8 weekly retained). Pillar 6 implements the actual SQL dump.
 * Both are no-ops for now — Pillar 1 wires the trigger and the queue/db
 * bindings; the fan-out logic itself needs the tax engine (Pillar 2) and
 * Deadline materialization (Pillar 3) first.
 */
export async function handleScheduled(
  event: ScheduledController,
  _env: Bindings,
  _ctx: ExecutionContext,
): Promise<void> {
  logger.info("scheduled-trigger-fired", { cron: event.cron });
}
