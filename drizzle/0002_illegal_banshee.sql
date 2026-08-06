CREATE TABLE `game_match_history` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`completed_at` text NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_match_history_players` (
	`history_id` text NOT NULL,
	`history_key_hash` text NOT NULL,
	`player_id` text NOT NULL,
	PRIMARY KEY(`history_id`, `history_key_hash`, `player_id`)
);
--> statement-breakpoint
CREATE INDEX `game_match_history_players_key_idx` ON `game_match_history_players` (`history_key_hash`);