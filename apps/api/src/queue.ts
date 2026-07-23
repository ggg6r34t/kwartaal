import type { Bindings, ExportQueueMessage, ReminderQueueMessage } from "./bindings";
import { logger } from "./lib/logger";

/**
 * Both queues share this handler; batch.queue tells you which. Messages are
 * acknowledged (not left to retry-storm) since no producer exists yet —
 * nothing enqueues to these queues until Pillar 3 (reminders) and Pillar 4
 * (exports) wire the actual send/build logic.
 */
export async function handleQueue(
  batch: MessageBatch<ReminderQueueMessage | ExportQueueMessage>,
  _env: Bindings,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    logger.info("queue-message-received", {
      queue: batch.queue,
      kind: message.body.kind,
    });
    // Pillar 3 implements the reminder consumer (send via Resend, write
    // ReminderLog, idempotent per (org, deadline, stage)).
    // Pillar 4 implements the export consumer (build the zip/PDF, write to
    // R2, update ExportJob status).
    message.ack();
  }
}
