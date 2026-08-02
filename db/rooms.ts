import { env } from "cloudflare:workers";
import type { GameState } from "@/lib/game";

type RoomRow = { state: string; revision: number };
type PresenceRow = { player_id: string; last_seen_at: string; online: number };

export type RoomRecord = { state: GameState; revision: number };
export type PresenceMap = Record<string, { online: boolean; lastSeenAt: string }>;

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!env.DB) throw new Error("房间数据库暂时不可用。 ");
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.DB.batch([
        env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS game_rooms (
            code TEXT PRIMARY KEY,
            state TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS game_rooms_updated_idx ON game_rooms (updated_at)"),
        env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS game_presence (
            room_code TEXT NOT NULL,
            player_id TEXT NOT NULL,
            last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (room_code, player_id)
          )
        `),
        env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS game_rate_limits (
            key TEXT NOT NULL,
            window INTEGER NOT NULL,
            count INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (key, window)
          )
        `),
      ]);
      const columns = await env.DB.prepare("PRAGMA table_info(game_rooms)").all<{ name: string }>();
      if (!columns.results.some((column) => column.name === "revision")) {
        await env.DB.prepare("ALTER TABLE game_rooms ADD COLUMN revision INTEGER NOT NULL DEFAULT 1").run();
      }
      await env.DB.prepare("PRAGMA optimize").run();
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
  return env.DB;
}

export async function loadRoomRecord(code: string): Promise<RoomRecord | null> {
  const db = await ensureSchema();
  const row = await db
    .prepare("SELECT state, revision FROM game_rooms WHERE code = ? AND updated_at >= datetime('now', '-7 days')")
    .bind(code)
    .first<RoomRow>();
  return row ? { state: JSON.parse(row.state) as GameState, revision: row.revision } : null;
}

export async function loadRoom(code: string): Promise<GameState | null> {
  return (await loadRoomRecord(code))?.state ?? null;
}

export async function insertRoom(state: GameState) {
  const db = await ensureSchema();
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO game_rooms (code, state, revision, updated_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)",
    )
    .bind(state.code, JSON.stringify(state))
    .run();
  return result.meta.changes === 1;
}

export async function saveRoom(state: GameState, expectedRevision: number) {
  const db = await ensureSchema();
  const result = await db
    .prepare(
      "UPDATE game_rooms SET state = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE code = ? AND revision = ?",
    )
    .bind(JSON.stringify(state), state.code, expectedRevision)
    .run();
  return result.meta.changes === 1;
}

export async function touchPresence(roomCode: string, playerId: string) {
  const db = await ensureSchema();
  await db.prepare(`
    INSERT INTO game_presence (room_code, player_id, last_seen_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(room_code, player_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
    WHERE last_seen_at <= datetime('now', '-4 seconds')
  `).bind(roomCode, playerId).run();
}

export async function loadPresence(roomCode: string): Promise<PresenceMap> {
  const db = await ensureSchema();
  const rows = await db.prepare(`
    SELECT player_id, last_seen_at,
      CASE WHEN last_seen_at >= datetime('now', '-15 seconds') THEN 1 ELSE 0 END AS online
    FROM game_presence WHERE room_code = ?
  `).bind(roomCode).all<PresenceRow>();
  return Object.fromEntries(rows.results.map((row) => [
    row.player_id,
    { online: Boolean(row.online), lastSeenAt: row.last_seen_at },
  ]));
}

export async function deletePlayerMetadata(roomCode: string, playerId: string) {
  const db = await ensureSchema();
  await db.prepare("DELETE FROM game_presence WHERE room_code = ? AND player_id = ?").bind(roomCode, playerId).run();
}

export async function isPlayerOffline(roomCode: string, playerId: string, seconds = 45) {
  const db = await ensureSchema();
  const row = await db.prepare(`
    SELECT CASE WHEN last_seen_at < datetime('now', ?) THEN 1 ELSE 0 END AS offline
    FROM game_presence WHERE room_code = ? AND player_id = ?
  `).bind(`-${seconds} seconds`, roomCode, playerId).first<{ offline: number }>();
  return !row || Boolean(row.offline);
}

export async function enforceRateLimit(key: string, maximum: number) {
  const db = await ensureSchema();
  const window = Math.floor(Date.now() / 60_000);
  const row = await db.prepare(`
    INSERT INTO game_rate_limits (key, window, count) VALUES (?, ?, 1)
    ON CONFLICT(key, window) DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(key, window).first<{ count: number }>();
  if ((row?.count ?? 1) > maximum) throw new Error("操作太频繁，请稍等一分钟再试。 ");
}

export async function cleanupExpiredRooms() {
  const db = await ensureSchema();
  const expired = "SELECT code FROM game_rooms WHERE updated_at < datetime('now', '-7 days')";
  await db.batch([
    db.prepare(`DELETE FROM game_presence WHERE room_code IN (${expired})`),
    db.prepare(`DELETE FROM game_rooms WHERE updated_at < datetime('now', '-7 days')`),
    db.prepare("DELETE FROM game_rate_limits WHERE window < ?").bind(Math.floor(Date.now() / 60_000) - 5),
  ]);
}
