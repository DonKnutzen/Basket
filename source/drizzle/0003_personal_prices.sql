ALTER TABLE `receipt_lines` ADD `observation_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `country` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `branch` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `date_evidence` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `fingerprint` text;--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_fingerprint` ON `receipts` (`household_id`,`fingerprint`);