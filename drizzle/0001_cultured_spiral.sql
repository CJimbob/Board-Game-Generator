CREATE TABLE `game_presence` (
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`room_code`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `game_rate_limits` (
	`key` text NOT NULL,
	`window` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`key`, `window`)
);
--> statement-breakpoint
ALTER TABLE `game_rooms` ADD `revision` integer DEFAULT 1 NOT NULL;