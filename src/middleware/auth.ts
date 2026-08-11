import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { cloudflareAccess } from "@hono/cloudflare-access";
import type { AppVariables, Env, User } from "../types";
import {
  findUserByApiToken,
  findUserBySession,
  upsertAccessUser,
} from "../services/users";

type AccessPayload = {
  email?: string;
  common_name?: string;
  name?: string;
  aud?: string | string[];
};

export const attachBearerUser = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const bearer = getBearer(c.req.header("Authorization"));
  if (bearer) {
    const user = await findUserByApiToken(c.env.DB, bearer);
    if (user) {
      c.set("user", user);
    }
  }
  await next();
});

export const attachSessionUser = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  if (c.get("user")) {
    await next();
    return;
  }

  if (c.env.AUTH_MODE !== "session") {
    await next();
    return;
  }

  const sessionId = getCookie(c, "session");
  if (sessionId) {
    const user = await findUserBySession(c.env.DB, sessionId);
    if (user) {
      c.set("user", user);
    }
  }

  await next();
});

/** Cloudflare Access JWT を検証し、email から D1 ユーザーを確保する */
export function accessAuthMiddleware(env: Env) {
  const team = env.CF_ACCESS_TEAM_NAME;
  if (!team) {
    throw new Error("CF_ACCESS_TEAM_NAME is required when AUTH_MODE=access");
  }

  const access = cloudflareAccess(team);

  return createMiddleware<{
    Bindings: Env;
    Variables: AppVariables;
  }>(async (c, next) => {
    if (c.get("user")) {
      await next();
      return;
    }

    let authorized = false;

    const accessResult = await access(c, async () => {
      const payload = c.get("accessPayload") as AccessPayload;

      if (env.CF_ACCESS_AUD && !audienceMatches(payload.aud, env.CF_ACCESS_AUD)) {
        return;
      }

      const email = payload?.email ?? payload?.common_name;
      if (!email) {
        return;
      }

      const user = await upsertAccessUser(
        c.env.DB,
        email,
        payload?.name ?? payload?.common_name,
      );
      c.set("user", user);
      authorized = true;
      await next();
    });

    if (accessResult) {
      return accessResult;
    }

    if (!authorized) {
      return c.json({ message: "Unauthenticated." }, 401);
    }
  });
}

export const requireUser = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const user = c.get("user") as User | undefined;
  if (!user) {
    if (wantsHtml(c.req.header("Accept"))) {
      return c.redirect("/login");
    }
    return c.json({ message: "Unauthenticated." }, 401);
  }

  await next();
});

export const requireGuest = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  if (c.get("user")) {
    return c.redirect("/map");
  }
  await next();
});

function audienceMatches(aud: string | string[] | undefined, expected: string): boolean {
  if (!aud) {
    return false;
  }
  return Array.isArray(aud) ? aud.includes(expected) : aud === expected;
}

function getBearer(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

function wantsHtml(accept: string | undefined): boolean {
  return Boolean(accept?.includes("text/html"));
}
