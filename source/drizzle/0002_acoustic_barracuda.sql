CREATE TABLE `item_icons` (
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	PRIMARY KEY(`household_id`, `name`)
);
