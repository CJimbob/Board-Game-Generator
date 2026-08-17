import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gameRooms = sqliteTable("game_rooms", {
  code: text("code").primaryKey(),
  state: text("state").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const gamePresence = sqliteTable("game_presence", {
  roomCode: text("room_code").notNull(),
  playerId: text("player_id").notNull(),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.roomCode, table.playerId] })]);

export const gameRateLimits = sqliteTable("game_rate_limits", {
  key: text("key").notNull(),
  window: integer("window").notNull(),
  count: integer("count").notNull().default(1),
}, (table) => [primaryKey({ columns: [table.key, table.window] })]);

export const gameMatchHistory = sqliteTable("game_match_history", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull(),
  completedAt: text("completed_at").notNull(),
  summary: text("summary").notNull(),
});

export const gameMatchHistoryPlayers = sqliteTable("game_match_history_players", {
  historyId: text("history_id").notNull(),
  historyKeyHash: text("history_key_hash").notNull(),
  playerId: text("player_id").notNull(),
}, (table) => [
  primaryKey({ columns: [table.historyId, table.historyKeyHash, table.playerId] }),
  index("game_match_history_players_key_idx").on(table.historyKeyHash),
]);
