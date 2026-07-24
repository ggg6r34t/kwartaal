ALTER TABLE `deadlines` ADD `same_day_reminder_requested_at` integer;--> statement-breakpoint
ALTER TABLE `receipts` ADD `amount_cents` integer;--> statement-breakpoint
ALTER TABLE `receipts` ADD `note` text;--> statement-breakpoint
ALTER TABLE `set_aside_entries` ADD `status` text DEFAULT 'confirmed' NOT NULL;