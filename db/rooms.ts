import { env } from "cloudflare:workers";
import type { GameState } from "@/lib/game";

type RoomRow = { state: string };

async function ensureSchema() {
  if (!env.DB) throw new Error("房间数据库暂时不可用。 ");
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS game_rooms (
        code TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS game_rooms_updated_idx ON game_rooms (updated_at)",
    ),
  ]);
  return env.DB;
}

export async function loadRoom(code: string): Promise<GameState | null> {
  const db = await ensureSchema();
  const row = await db
    .prepare("SELECT state FROM game_rooms WHERE code = ?")
    .bind(code)
    .first<RoomRow>();
  return row ? (JSON.parse(row.state) as GameState) : null;
}

export async function insertRoom(state: GameState) {
  const db = await ensureSchema();
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO game_rooms (code, state, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
    )
    .bind(state.code, JSON.stringify(state))
    .run();
  return result.meta.changes === 1;
}

export async function saveRoom(state: GameState) {
  const db = await ensureSchema();
  await db
    .prepare(
      "UPDATE game_rooms SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?",
    )
    .bind(JSON.stringify(state), state.code)
    .run();
}

