import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
