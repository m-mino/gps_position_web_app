import type { User } from "../types";
import { nowIso } from "../lib/dates";
import { hashPassword, verifyPassword } from "../lib/password";
import { randomToken, sha256Hex } from "../lib/crypto";

export async function findUserById(db: D1Database, id: number): Promise<User | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();
}

export async function findUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first<User>();
}

export async function listUsers(db: D1Database): Promise<User[]> {
  const result = await db.prepare("SELECT * FROM users ORDER BY id ASC").all<User>();
  return result.results ?? [];
}

export type GpsUserSummary = {
  id: number;
  name: string;
  email: string;
  has_password: boolean;
  created_at: string;
  latest: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recorded_at: string;
  } | null;
};

/** GPS端末向けアカウント一覧（最新位置つき） */
export async function listGpsUsers(db: D1Database): Promise<GpsUserSummary[]> {
  const result = await db
    .prepare(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.password_hash,
         u.created_at,
         p.latitude AS latest_latitude,
         p.longitude AS latest_longitude,
         p.accuracy AS latest_accuracy,
         p.recorded_at AS latest_recorded_at
       FROM users u
       LEFT JOIN (
         SELECT user_id, MAX(recorded_at) AS max_recorded_at
         FROM positions
         GROUP BY user_id
       ) latest ON latest.user_id = u.id
       LEFT JOIN positions p
         ON p.user_id = latest.user_id
        AND p.recorded_at = latest.max_recorded_at
       WHERE u.password_hash IS NOT NULL
       ORDER BY u.id ASC`,
    )
    .all<{
      id: number;
      name: string;
      email: string;
      password_hash: string | null;
      created_at: string;
      latest_latitude: number | null;
      latest_longitude: number | null;
      latest_accuracy: number | null;
      latest_recorded_at: string | null;
    }>();

  const seen = new Set<number>();
  const users: GpsUserSummary[] = [];

  for (const row of result.results ?? []) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);

    const hasLatest =
      row.latest_latitude != null &&
      row.latest_longitude != null &&
      row.latest_recorded_at != null;

    users.push({
      id: row.id,
      name: row.name,
      email: row.email,
      has_password: Boolean(row.password_hash),
      created_at: row.created_at,
      latest: hasLatest
        ? {
            latitude: row.latest_latitude!,
            longitude: row.latest_longitude!,
            accuracy: row.latest_accuracy,
            recorded_at: new Date(row.latest_recorded_at!).toISOString(),
          }
        : null,
    });
  }

  return users;
}

export async function upsertAccessUser(
  db: D1Database,
  email: string,
  name?: string,
): Promise<User> {
  const normalized = email.toLowerCase();
  const existing = await findUserByEmail(db, normalized);
  if (existing) {
    return existing;
  }

  const displayName = name?.trim() || normalized.split("@")[0] || "User";
  const ts = nowIso();
  const result = await db
    .prepare(
      `INSERT INTO users (name, email, password_hash, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?)
       RETURNING *`,
    )
    .bind(displayName, normalized, ts, ts)
    .first<User>();

  if (!result) {
    throw new Error("Failed to create user from Access identity");
  }

  return result;
}

export async function createUser(
  db: D1Database,
  input: { name: string; email: string; password: string },
): Promise<User> {
  const ts = nowIso();
  const passwordHash = await hashPassword(input.password);
  const result = await db
    .prepare(
      `INSERT INTO users (name, email, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(input.name, input.email.toLowerCase(), passwordHash, ts, ts)
    .first<User>();

  if (!result) {
    throw new Error("Failed to create user");
  }

  return result;
}

export async function updateUserProfile(
  db: D1Database,
  userId: number,
  input: { name: string; email: string },
): Promise<User | null> {
  const ts = nowIso();
  return db
    .prepare(
      `UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ? RETURNING *`,
    )
    .bind(input.name, input.email.toLowerCase(), ts, userId)
    .first<User>();
}

export async function updateUserPassword(
  db: D1Database,
  userId: number,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password);
  const ts = nowIso();
  await db
    .prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
    .bind(passwordHash, ts, userId)
    .run();
}

export async function deleteUser(db: D1Database, userId: number): Promise<void> {
  await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
}

export async function authenticateWithPassword(
  db: D1Database,
  email: string,
  password: string,
): Promise<User | null> {
  const user = await findUserByEmail(db, email);
  if (!user) {
    return null;
  }

  const ok = await verifyPassword(password, user.password_hash);
  return ok ? user : null;
}

export async function createApiToken(
  db: D1Database,
  userId: number,
  name: string,
): Promise<string> {
  const plain = randomToken(32);
  const tokenHash = await sha256Hex(plain);
  const ts = nowIso();

  const row = await db
    .prepare(
      `INSERT INTO api_tokens (user_id, name, token_hash, created_at)
       VALUES (?, ?, ?, ?)
       RETURNING id`,
    )
    .bind(userId, name, tokenHash, ts)
    .first<{ id: number }>();

  if (!row) {
    throw new Error("Failed to create API token");
  }

  return `${row.id}|${plain}`;
}

export async function findUserByApiToken(
  db: D1Database,
  token: string,
): Promise<User | null> {
  const separator = token.indexOf("|");
  if (separator <= 0) {
    return null;
  }

  const id = Number(token.slice(0, separator));
  const plain = token.slice(separator + 1);
  if (!Number.isInteger(id) || !plain) {
    return null;
  }

  const tokenHash = await sha256Hex(plain);
  const row = await db
    .prepare(
      `SELECT u.*
       FROM api_tokens t
       INNER JOIN users u ON u.id = t.user_id
       WHERE t.id = ? AND t.token_hash = ?`,
    )
    .bind(id, tokenHash)
    .first<User>();

  if (!row) {
    return null;
  }

  await db
    .prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
    .bind(nowIso(), id)
    .run();

  return row;
}

export async function deleteApiTokenByPlain(
  db: D1Database,
  token: string,
): Promise<boolean> {
  const separator = token.indexOf("|");
  if (separator <= 0) {
    return false;
  }

  const id = Number(token.slice(0, separator));
  const plain = token.slice(separator + 1);
  if (!Number.isInteger(id) || !plain) {
    return false;
  }

  const tokenHash = await sha256Hex(plain);
  const result = await db
    .prepare("DELETE FROM api_tokens WHERE id = ? AND token_hash = ?")
    .bind(id, tokenHash)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

export async function createSession(
  db: D1Database,
  userId: number,
  ttlHours = 120,
): Promise<string> {
  const id = randomToken(24);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(id, userId, expiresAt, nowIso())
    .run();
  return id;
}

export async function findUserBySession(
  db: D1Database,
  sessionId: string,
): Promise<User | null> {
  const row = await db
    .prepare(
      `SELECT u.*
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, nowIso())
    .first<User>();

  return row;
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}
