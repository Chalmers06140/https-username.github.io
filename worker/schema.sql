CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`group_number` integer NOT NULL,
	`seat` integer NOT NULL,
	`joined_at` text NOT NULL
);
CREATE UNIQUE INDEX `participants_group_seat` ON `participants` (`group_number`,`seat`);