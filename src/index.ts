import { Hono } from "hono";
import type { AppVariables, Env } from "./types";
import { api } from "./routes/api";
import { web } from "./routes/web";
import {
  accessAuthMiddleware,
  attachBearerUser,
  attachSessionUser,
} from "./middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", async (c, next) => {
  // 静的アセットは認証前に返す
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/assets/") || path === "/favicon.ico") {
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (asset.status !== 404) {
      return asset;
    }
  }
  await next();
});

app.use("*", attachBearerUser);

app.use("*", async (c, next) => {
  if (c.env.AUTH_MODE === "access") {
    // OwnTracks / API トークン発行は Access 外（端末向け）
    const path = new URL(c.req.url).pathname;
    const bypass =
      path === "/api/owntracks" ||
      path === "/api/login" ||
      path === "/up" ||
      Boolean(c.get("user"));

    if (!bypass) {
      const middleware = accessAuthMiddleware(c.env);
      return middleware(c, next);
    }
  }

  return attachSessionUser(c, next);
});

app.route("/api", api);
app.route("/", web);

app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/")) {
    return c.json({ message: "Not Found" }, 404);
  }

  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) {
    return asset;
  }

  return c.text("Not Found", 404);
});

export default app;
