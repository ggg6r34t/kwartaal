CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`ip` text,
	`meta` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_logs_org_idx` ON `audit_logs` (`org_id`);--> statement-breakpoint
CREATE TABLE `business_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`legal_form` text NOT NULL,
	`kvk_registered_at` text,
	`kor_opt_in` integer DEFAULT false NOT NULL,
	`kor_since` text,
	`has_salaried_job` integer DEFAULT false NOT NULL,
	`startersaftrek_used_count` integer DEFAULT 0 NOT NULL,
	`default_set_aside_rate_bps` integer DEFAULT 3000 NOT NULL,
	`first_quarter_closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_profiles_org_idx` ON `business_profiles` (`org_id`);--> statement-breakpoint
CREATE TABLE `deadlines` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`kind` text NOT NULL,
	`due_date` text NOT NULL,
	`quarter_id` text,
	`dismissed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quarter_id`) REFERENCES `quarters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deadlines_org_idx` ON `deadlines` (`org_id`);--> statement-breakpoint
CREATE INDEX `deadlines_org_due_date_idx` ON `deadlines` (`org_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `depreciation_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`expense_line_id` text NOT NULL,
	`years` integer NOT NULL,
	`residual_cents` integer DEFAULT 0 NOT NULL,
	`annual_cents` integer NOT NULL,
	`start_month` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_line_id`) REFERENCES `expense_lines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `depreciation_schedules_org_idx` ON `depreciation_schedules` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `depreciation_schedules_expense_line_idx` ON `depreciation_schedules` (`expense_line_id`);--> statement-breakpoint
CREATE TABLE `expense_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`quarter_id` text NOT NULL,
	`date` text NOT NULL,
	`supplier` text NOT NULL,
	`amount_ex_vat_cents` integer NOT NULL,
	`vat_rate` text NOT NULL,
	`vat_cents` integer NOT NULL,
	`vat_reclaimable` integer DEFAULT true NOT NULL,
	`is_startup_cost` integer DEFAULT false NOT NULL,
	`deduction_mode` text DEFAULT 'expense' NOT NULL,
	`receipt_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quarter_id`) REFERENCES `quarters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `expense_lines_org_idx` ON `expense_lines` (`org_id`);--> statement-breakpoint
CREATE INDEX `expense_lines_quarter_idx` ON `expense_lines` (`quarter_id`);--> statement-breakpoint
CREATE TABLE `export_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`r2_key` text,
	`requested_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `export_jobs_org_idx` ON `export_jobs` (`org_id`);--> statement-breakpoint
CREATE TABLE `glossary_terms` (
	`slug` text PRIMARY KEY NOT NULL,
	`nl_term` text NOT NULL,
	`en_gloss` text NOT NULL,
	`plain_explanation` text NOT NULL,
	`where_youll_see_it` text NOT NULL,
	`depth` text DEFAULT 'stub' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hours_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`date` text NOT NULL,
	`hours` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hours_entries_org_idx` ON `hours_entries` (`org_id`);--> statement-breakpoint
CREATE TABLE `income_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`quarter_id` text NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount_ex_vat_cents` integer NOT NULL,
	`vat_rate` text NOT NULL,
	`vat_cents` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`import_source` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quarter_id`) REFERENCES `quarters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `income_lines_org_idx` ON `income_lines` (`org_id`);--> statement-breakpoint
CREATE INDEX `income_lines_quarter_idx` ON `income_lines` (`quarter_id`);--> statement-breakpoint
CREATE TABLE `km_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`date` text NOT NULL,
	`km` integer NOT NULL,
	`purpose` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `km_entries_org_idx` ON `km_entries` (`org_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_org_idx` ON `notifications` (`org_id`);--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pots` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`target_cents` integer DEFAULT 0 NOT NULL,
	`current_cents` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'business' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pots_org_idx` ON `pots` (`org_id`);--> statement-breakpoint
CREATE TABLE `quarters` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`year` integer NOT NULL,
	`q` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`filed_at` integer,
	`paid_at` integer,
	`rubriek_1a_cents` integer,
	`rubriek_1b_cents` integer,
	`rubriek_5b_cents` integer,
	`rubriek_5c_cents` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quarters_org_idx` ON `quarters` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quarters_org_year_q_idx` ON `quarters` (`org_id`,`year`,`q`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`captured_at` integer NOT NULL,
	`checklist` text,
	`missing_count` integer DEFAULT 6 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `receipts_org_idx` ON `receipts` (`org_id`);--> statement-breakpoint
CREATE TABLE `reminder_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`deadline_id` text NOT NULL,
	`stage` text NOT NULL,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deadline_id`) REFERENCES `deadlines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminder_logs_org_idx` ON `reminder_logs` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_logs_org_deadline_stage_idx` ON `reminder_logs` (`org_id`,`deadline_id`,`stage`);--> statement-breakpoint
CREATE TABLE `secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`integration_id` text,
	`key_ref` text NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `secrets_org_idx` ON `secrets` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `secrets_org_integration_key_idx` ON `secrets` (`org_id`,`integration_id`,`key_ref`);--> statement-breakpoint
CREATE TABLE `set_aside_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`invoice_ref` text NOT NULL,
	`total_cents` integer NOT NULL,
	`vat_cents` integer NOT NULL,
	`reserve_cents` integer NOT NULL,
	`rate_bps` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `set_aside_entries_org_idx` ON `set_aside_entries` (`org_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`stripe_sub_id` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'incomplete' NOT NULL,
	`current_period_end` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_org_idx` ON `subscriptions` (`org_id`);--> statement-breakpoint
CREATE TABLE `tax_figures` (
	`year` integer PRIMARY KEY NOT NULL,
	`brackets_json` text NOT NULL,
	`zelfstandigenaftrek_cents` integer NOT NULL,
	`startersaftrek_cents` integer NOT NULL,
	`mkb_vrijstelling_bps` integer NOT NULL,
	`zvw_bps` integer NOT NULL,
	`kor_limit_cents` integer NOT NULL,
	`algemene_heffingskorting_max_cents` integer NOT NULL,
	`arbeidskorting_table_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_year_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`year` integer NOT NULL,
	`tax_figures_year` integer NOT NULL,
	`hours_target` integer DEFAULT 1225 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tax_figures_year`) REFERENCES `tax_figures`(`year`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tax_year_profiles_org_idx` ON `tax_year_profiles` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tax_year_profiles_org_year_idx` ON `tax_year_profiles` (`org_id`,`year`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `users_org_idx` ON `users` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_user_idx` ON `users` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `voorlopige_aanslagen` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`year` integer NOT NULL,
	`monthly_cents` integer NOT NULL,
	`start_month` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `voorlopige_aanslagen_org_idx` ON `voorlopige_aanslagen` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `voorlopige_aanslagen_org_year_idx` ON `voorlopige_aanslagen` (`org_id`,`year`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
