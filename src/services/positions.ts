import type { Position, PositionInput } from "../types";
import { nowIso } from "../lib/dates";
import { StayDetector } from "./stay-detector";

export function transformPosition(position: Position) {
  return {
    id: position.id,
    user_id: position.user_id,
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: position.accuracy,
    recorded_at: toIso(position.recorded_at),
  };
}

export async function createPosition(
  db: D1Database,
  userId: number,
  input: PositionInput,
): Promise<Position> {
  const ts = nowIso();
  const recordedAt = new Date(input.recorded_at).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO positions
        (user_id, latitude, longitude, accuracy, recorded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(
      userId,
      input.latitude,
      input.longitude,
      input.accuracy ?? null,
      recordedAt,
      ts,
      ts,
    )
    .first<Position>();

  if (!result) {
    throw new Error("Failed to create position");
  }

  return result;
}

export async function latestPositions(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT p.*, u.name AS user_name
       FROM positions p
       INNER JOIN users u ON u.id = p.user_id
       INNER JOIN (
         SELECT user_id, MAX(recorded_at) AS max_recorded_at
         FROM positions
         GROUP BY user_id
       ) latest
         ON latest.user_id = p.user_id
        AND latest.max_recorded_at = p.recorded_at
       ORDER BY p.user_id ASC, p.id DESC`,
    )
    .all<Position & { user_name: string }>();

  const seen = new Set<number>();
  const data = [];

  for (const row of result.results ?? []) {
    if (seen.has(row.user_id)) {
      continue;
    }
    seen.add(row.user_id);
    data.push({
      user_id: row.user_id,
      user_name: row.user_name,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracy: row.accuracy,
      recorded_at: toIso(row.recorded_at),
    });
  }

  return data;
}

export async function historyPositions(
  db: D1Database,
  userId: number,
  fromIso: string,
  toIso: string,
) {
  const result = await db
    .prepare(
      `SELECT *
       FROM positions
       WHERE user_id = ?
         AND recorded_at >= ?
         AND recorded_at <= ?
       ORDER BY recorded_at ASC, id ASC`,
    )
    .bind(userId, fromIso, toIso)
    .all<Position>();

  const positions = result.results ?? [];
  const stayDetector = new StayDetector();
  const stays = stayDetector.detect(positions);

  return {
    data: positions.map(transformPosition),
    stays,
    meta: {
      from: fromIso,
      to: toIso,
    },
  };
}

function toIso(value: string): string {
  return new Date(value).toISOString();
}
