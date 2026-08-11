import { Hono } from "hono";
import type { AppVariables, Env } from "../types";
import {
  authenticateWithPassword,
  createApiToken,
  deleteApiTokenByPlain,
  findUserById,
  publicUser,
} from "../services/users";
import {
  createPosition,
  historyPositions,
  latestPositions,
  transformPosition,
} from "../services/positions";
import {
  hoursAgoIso,
  isValidDateOnly,
  isValidIsoDate,
  nowIso,
  tokyoDayBounds,
  fromUnixSeconds,
} from "../lib/dates";
import { requireUser } from "../middleware/auth";
import { authenticateOwnTracks } from "../services/owntracks-auth";

const api = new Hono<{ Bindings: Env; Variables: AppVariables }>();

api.post("/login", async (c) => {
  const body = await c.req.json<{
    email?: string;
    password?: string;
    device_name?: string;
  }>();

  const errors: Record<string, string[]> = {};
  if (!body.email) errors.email = ["The email field is required."];
  if (!body.password) errors.password = ["The password field is required."];
  if (!body.device_name) errors.device_name = ["The device_name field is required."];
  if (Object.keys(errors).length > 0) {
    return c.json({ message: "Validation failed", errors }, 422);
  }

  const user = await authenticateWithPassword(c.env.DB, body.email!, body.password!);
  if (!user) {
    return c.json(
      {
        message: "The provided credentials are incorrect.",
        errors: { email: ["The provided credentials are incorrect."] },
      },
      422,
    );
  }

  const token = await createApiToken(c.env.DB, user.id, body.device_name!);
  return c.json({
    token,
    user: publicUser(user),
  });
});

api.post("/logout", requireUser, async (c) => {
  const authorization = c.req.header("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    await deleteApiTokenByPlain(c.env.DB, token);
  }
  return c.json({ message: "Logged out" });
});

api.post("/positions", requireUser, async (c) => {
  const body = await c.req.json<{
    latitude?: number;
    longitude?: number;
    accuracy?: number | null;
    recorded_at?: string;
  }>();

  const errors: Record<string, string[]> = {};
  if (typeof body.latitude !== "number" || body.latitude < -90 || body.latitude > 90) {
    errors.latitude = ["The latitude must be between -90 and 90."];
  }
  if (
    typeof body.longitude !== "number" ||
    body.longitude < -180 ||
    body.longitude > 180
  ) {
    errors.longitude = ["The longitude must be between -180 and 180."];
  }
  if (body.accuracy != null && (typeof body.accuracy !== "number" || body.accuracy < 0)) {
    errors.accuracy = ["The accuracy must be a number greater than or equal to 0."];
  }
  if (!body.recorded_at || !isValidIsoDate(body.recorded_at)) {
    errors.recorded_at = ["The recorded_at field must be a valid date."];
  }
  if (Object.keys(errors).length > 0) {
    return c.json({ message: "Validation failed", errors }, 422);
  }

  const user = c.get("user");
  const position = await createPosition(c.env.DB, user.id, {
    latitude: body.latitude!,
    longitude: body.longitude!,
    accuracy: body.accuracy ?? null,
    recorded_at: body.recorded_at!,
  });

  return c.json({ data: transformPosition(position) }, 201);
});

api.get("/positions/latest", requireUser, async (c) => {
  const data = await latestPositions(c.env.DB);
  return c.json({ data });
});

api.get("/positions", requireUser, async (c) => {
  const userIdRaw = c.req.query("user_id");
  const fromRaw = c.req.query("from");
  const toRaw = c.req.query("to");

  const userId = Number(userIdRaw);
  if (!userIdRaw || !Number.isInteger(userId)) {
    return c.json(
      {
        message: "Validation failed",
        errors: { user_id: ["The user_id field is required."] },
      },
      422,
    );
  }

  const target = await findUserById(c.env.DB, userId);
  if (!target) {
    return c.json(
      {
        message: "Validation failed",
        errors: { user_id: ["The selected user_id is invalid."] },
      },
      422,
    );
  }

  if (fromRaw && !isValidDateOnly(fromRaw) && !isValidIsoDate(fromRaw)) {
    return c.json(
      { message: "Validation failed", errors: { from: ["Invalid from date."] } },
      422,
    );
  }
  if (toRaw && !isValidDateOnly(toRaw) && !isValidIsoDate(toRaw)) {
    return c.json(
      { message: "Validation failed", errors: { to: ["Invalid to date."] } },
      422,
    );
  }

  const from = fromRaw
    ? isValidDateOnly(fromRaw)
      ? tokyoDayBounds(fromRaw, "start")
      : new Date(fromRaw).toISOString()
    : hoursAgoIso(24);
  const to = toRaw
    ? isValidDateOnly(toRaw)
      ? tokyoDayBounds(toRaw, "end")
      : new Date(toRaw).toISOString()
    : nowIso();

  if (Date.parse(from) > Date.parse(to)) {
    return c.json(
      {
        message: "Validation failed",
        errors: { to: ["The to field must be a date after or equal to from."] },
      },
      422,
    );
  }

  const payload = await historyPositions(c.env.DB, userId, from, to);
  return c.json(payload);
});

api.post("/owntracks", async (c) => {
  const user = await authenticateOwnTracks(c);
  if (!user) {
    return c.json({ message: "Unauthenticated." }, 401, {
      "WWW-Authenticate": 'Basic realm="GPS Position"',
    });
  }

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json([]);
  }

  if (payload == null || (typeof payload === "object" && !Array.isArray(payload) && Object.keys(payload as object).length === 0)) {
    return c.json([]);
  }

  const items = Array.isArray(payload) ? payload : [payload];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    if (record._type !== "location") {
      continue;
    }
    if (
      typeof record.lat !== "number" ||
      typeof record.lon !== "number" ||
      typeof record.tst !== "number"
    ) {
      continue;
    }

    await createPosition(c.env.DB, user.id, {
      latitude: record.lat,
      longitude: record.lon,
      accuracy: typeof record.acc === "number" ? record.acc : null,
      recorded_at: fromUnixSeconds(record.tst),
    });
  }

  return c.json([]);
});

export { api };
