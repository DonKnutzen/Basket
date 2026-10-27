CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`month` text NOT NULL,
	`currency` text NOT NULL,
	`category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_month_budget` ON `budgets` (`household_id`,`month`,`currency`,`category`);--> statement-breakpoint
CREATE INDEX `budgets_household` ON `budgets` (`household_id`);