ALTER TABLE `business_profiles` ADD `reminder_cadence` text DEFAULT 'persistent' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_profiles` ADD `onboarded_at` integer;