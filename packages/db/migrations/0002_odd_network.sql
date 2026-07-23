ALTER TABLE `export_jobs` ADD `kind` text DEFAULT 'data' NOT NULL;--> statement-breakpoint
ALTER TABLE `export_jobs` ADD `year` integer;