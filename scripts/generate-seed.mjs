import { writeFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return `pbkdf2$${ITERATIONS}$${bufferToHex(salt.buffer)}$${bufferToHex(derived)}`;
}

function iso(daysAgo, hour, minute) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  // Treat as Asia/Tokyo local wall time roughly by constructing +09:00
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${y}-${m}-${day}T${hh}:${mm}:00+09:00`).toISOString();
}

function addStay(userId, lat, lon, startIso, minutes) {
  const rows = [];
  const start = Date.parse(startIso);
  const steps = Math.max(2, Math.floor(minutes / 2));
  for (let i = 0; i < steps; i++) {
    const t = new Date(start + i * 2 * 60 * 1000).toISOString();
    const jitterLat = lat + (Math.random() - 0.5) * 0.00005;
    const jitterLon = lon + (Math.random() - 0.5) * 0.00005;
    rows.push(
      `INSERT INTO positions (user_id, latitude, longitude, accuracy, recorded_at) VALUES (${userId}, ${jitterLat.toFixed(7)}, ${jitterLon.toFixed(7)}, 12, '${t}');`,
    );
  }
  return rows;
}

function addPath(userId, points, startIso, intervalMinutes) {
  const rows = [];
  const start = Date.parse(startIso);
  points.forEach((p, i) => {
    const t = new Date(start + i * intervalMinutes * 60 * 1000).toISOString();
    rows.push(
      `INSERT INTO positions (user_id, latitude, longitude, accuracy, recorded_at) VALUES (${userId}, ${p[0]}, ${p[1]}, 15, '${t}');`,
    );
  });
  return rows;
}

const passwordHash = await hashPassword("password");

const sql = [];
sql.push("DELETE FROM positions;");
sql.push("DELETE FROM api_tokens;");
sql.push("DELETE FROM sessions;");
sql.push("DELETE FROM users;");
sql.push(
  `INSERT INTO users (id, name, email, password_hash) VALUES (1, 'Test User', 'test@example.com', '${passwordHash}');`,
);
sql.push(
  `INSERT INTO users (id, name, email, password_hash) VALUES (2, 'Demo Walker', 'walker@example.com', '${passwordHash}');`,
);
sql.push(
  `INSERT INTO users (id, name, email, password_hash) VALUES (3, 'Demo Driver', 'driver@example.com', '${passwordHash}');`,
);

// Walker (2) - Tokyo
sql.push(...addStay(2, 35.681236, 139.767125, iso(0, 9, 0), 20));
sql.push(
  ...addPath(
    2,
    [
      [35.681236, 139.767125],
      [35.68, 139.7685],
      [35.678, 139.77],
      [35.676, 139.7715],
      [35.6717, 139.7649],
    ],
    iso(0, 9, 25),
    3,
  ),
);
sql.push(...addStay(2, 35.6717, 139.7649, iso(0, 9, 40), 45));
sql.push(
  ...addPath(
    2,
    [
      [35.6717, 139.7649],
      [35.6735, 139.768],
      [35.68, 139.772],
      [35.683, 139.775],
    ],
    iso(0, 10, 30),
    4,
  ),
);

// Driver (3) - Akashi
sql.push(...addStay(3, 34.6805, 134.9072, iso(0, 8, 30), 18));
sql.push(
  ...addPath(
    3,
    [
      [34.6805, 134.9072],
      [34.6812, 134.908],
      [34.682, 134.909],
      [34.683, 134.9105],
      [34.684, 134.9118],
    ],
    iso(0, 8, 50),
    3,
  ),
);

// Viewer (1)
sql.push(...addStay(1, 35.681236, 139.767125, iso(0, 13, 0), 25));
sql.push(
  ...addPath(
    1,
    [
      [35.681236, 139.767125],
      [35.6825, 139.769],
      [35.684, 139.771],
    ],
    iso(0, 13, 30),
    5,
  ),
);

writeFileSync(new URL("../seed/seed.sql", import.meta.url), `${sql.join("\n")}\n`, "utf8");
console.log("Wrote seed/seed.sql");
