CREATE TABLE `accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`household_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `aliases` (
	`household_id` text NOT NULL,
	`store` text NOT NULL,
	`label` text NOT NULL,
	`product_id` text NOT NULL,
	PRIMARY KEY(`household_id`, `store`, `label`)
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`invite_hash` text,
	`invite_expires` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` text NOT NULL,
	`category` text NOT NULL,
	`checked` integer DEFAULT 0 NOT NULL,
	`added_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `items_list` ON `items` (`list_id`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lists_household` ON `lists` (`household_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	PRIMARY KEY(`household_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized` text NOT NULL,
	`category` text NOT NULL,
	`pack_size` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_identity` ON `products` (`household_id`,`normalized`);--> statement-breakpoint
CREATE TABLE `receipt_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`product_id` text NOT NULL,
	`label` text NOT NULL,
	`quantity` real NOT NULL,
	`amount_cents` integer NOT NULL,
	`category` text NOT NULL,
	`pack_size` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lines_receipt` ON `receipt_lines` (`receipt_id`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`store` text NOT NULL,
	`date` text NOT NULL,
	`total_cents` integer NOT NULL,
	`tax_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`image_key` text,
	`raw_text` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `receipts_household` ON `receipts` (`household_id`);