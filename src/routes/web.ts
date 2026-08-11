import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { AppVariables, Env } from "../types";
import {
  accessRequiredPage,
  dataTablesPage,
  gpsUsersPage,
  loginPage,
  mapPage,
  profilePage,
  registerPage,
} from "../views/pages";
import { requireGuest, requireUser } from "../middleware/auth";
import {
  authenticateWithPassword,
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  findUserByEmail,
  findUserById,
  listGpsUsers,
  listUsers,
  updateUserPassword,
  updateUserProfile,
} from "../services/users";
import {
  browseTable,
  DEFAULT_TABLE,
  isDataTableName,
  listTableSummaries,
} from "../services/tables";
import { verifyPassword } from "../lib/password";
import { getCookie } from "hono/cookie";

const web = new Hono<{ Bindings: Env; Variables: AppVariables }>();

web.get("/", (c) => {
  if (c.get("user")) {
    return c.redirect("/map");
  }
  if (c.env.AUTH_MODE === "access") {
    return c.redirect("/map");
  }
  return c.redirect("/login");
});

web.get("/login", requireGuest, (c) => {
  if (c.env.AUTH_MODE === "access") {
    return c.html(accessRequiredPage(c.env.APP_NAME));
  }
  return c.html(loginPage(c.env.APP_NAME));
});

web.post("/login", requireGuest, async (c) => {
  if (c.env.AUTH_MODE === "access") {
    return c.redirect("/map");
  }

  const body = await c.req.parseBody();
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  const user = await authenticateWithPassword(c.env.DB, email, password);

  if (!user) {
    return c.html(loginPage(c.env.APP_NAME, "メールまたはパスワードが正しくありません。"), 422);
  }

  const sessionId = await createSession(c.env.DB, user.id);
  setCookie(c, "session", sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: isSecure(c),
    maxAge: 60 * 60 * 120,
  });

  return c.redirect("/map");
});

web.get("/register", requireGuest, (c) => {
  if (c.env.AUTH_MODE === "access") {
    return c.html(accessRequiredPage(c.env.APP_NAME));
  }
  return c.html(registerPage(c.env.APP_NAME));
});

web.post("/register", requireGuest, async (c) => {
  if (c.env.AUTH_MODE === "access") {
    return c.redirect("/map");
  }

  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const confirmation = String(body.password_confirmation ?? "");

  if (!name || !email || password.length < 8) {
    return c.html(registerPage(c.env.APP_NAME, "入力内容を確認してください。"), 422);
  }
  if (password !== confirmation) {
    return c.html(registerPage(c.env.APP_NAME, "パスワードが一致しません。"), 422);
  }

  const existing = await findUserByEmail(c.env.DB, email);
  if (existing) {
    return c.html(registerPage(c.env.APP_NAME, "このメールアドレスは既に登録されています。"), 422);
  }

  const user = await createUser(c.env.DB, { name, email, password });
  const sessionId = await createSession(c.env.DB, user.id);
  setCookie(c, "session", sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: isSecure(c),
    maxAge: 60 * 60 * 120,
  });

  return c.redirect("/map");
});

web.post("/logout", requireUser, async (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    await deleteSession(c.env.DB, sessionId);
  }
  deleteCookie(c, "session", { path: "/" });
  return c.redirect(c.env.AUTH_MODE === "access" ? "/map" : "/login");
});

web.get("/dashboard", requireUser, (c) => c.redirect("/map"));

web.get("/map", requireUser, (c) => {
  return c.html(mapPage(c.env.APP_NAME, c.get("user")));
});

web.get("/tables", requireUser, async (c) => {
  const tableRaw = c.req.query("table");
  const table = isDataTableName(tableRaw) ? tableRaw : DEFAULT_TABLE;
  const page = Number(c.req.query("page") ?? "1");
  const userIdRaw = c.req.query("user_id");
  const userId = userIdRaw && Number.isInteger(Number(userIdRaw)) ? Number(userIdRaw) : null;

  const [summaries, browse, users] = await Promise.all([
    listTableSummaries(c.env.DB),
    browseTable(c.env.DB, table, {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      userId,
    }),
    listUsers(c.env.DB),
  ]);

  return c.html(dataTablesPage(c.env.APP_NAME, c.get("user"), summaries, browse, users));
});

web.get("/users", requireUser, async (c) => {
  const users = await listGpsUsers(c.env.DB);
  return c.html(gpsUsersPage(c.env.APP_NAME, c.get("user"), users));
});

web.post("/users", requireUser, async (c) => {
  const viewer = c.get("user");
  const body = await c.req.parseBody();
  const action = String(body._action ?? "create_user");

  const render = async (
    opts: {
      message?: string;
      error?: string;
      form?: Partial<{ name: string; email: string }>;
      openUserId?: number;
    },
    status: 200 | 400 | 422 = 200,
  ) => {
    const users = await listGpsUsers(c.env.DB);
    return c.html(gpsUsersPage(c.env.APP_NAME, viewer, users, opts), status);
  };

  if (action === "update_password") {
    const userId = Number(body.user_id);
    const password = String(body.password ?? "");
    const confirmation = String(body.password_confirmation ?? "");

    if (!Number.isInteger(userId) || userId <= 0) {
      return render({ error: "対象ユーザーが不正です。" }, 400);
    }

    const target = await findUserById(c.env.DB, userId);
    if (!target || !target.password_hash) {
      return render({ error: "対象のGPSユーザーが見つかりません。" }, 422);
    }
    if (password.length < 8 || password !== confirmation) {
      return render(
        {
          error: "新しいパスワードは8文字以上で、確認入力と一致させてください。",
          openUserId: userId,
        },
        422,
      );
    }

    await updateUserPassword(c.env.DB, userId, password);
    return render({
      message: `「${target.name}」のパスワードを更新しました。`,
      openUserId: userId,
    });
  }

  if (action === "delete_user") {
    const userId = Number(body.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return render({ error: "対象ユーザーが不正です。" }, 400);
    }
    if (userId === viewer.id) {
      return render(
        { error: "自分自身のアカウントはこの画面からは削除できません。", openUserId: userId },
        422,
      );
    }

    const target = await findUserById(c.env.DB, userId);
    if (!target || !target.password_hash) {
      return render({ error: "対象のGPSユーザーが見つかりません。" }, 422);
    }

    await deleteUser(c.env.DB, userId);
    return render({ message: `「${target.name}」を削除しました。` });
  }

  if (action !== "create_user") {
    return render({ error: "不明な操作です。" }, 400);
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const confirmation = String(body.password_confirmation ?? "");
  const form = { name, email };

  if (!name || !email || password.length < 8) {
    return render(
      { error: "表示名・ユーザーID・8文字以上のパスワードを入力してください。", form },
      422,
    );
  }
  if (password !== confirmation) {
    return render({ error: "パスワードが一致しません。", form }, 422);
  }

  const existing = await findUserByEmail(c.env.DB, email);
  if (existing) {
    return render({ error: "このユーザーIDは既に登録されています。", form }, 422);
  }

  const created = await createUser(c.env.DB, { name, email, password });
  return render({
    message: `「${created.name}」を登録しました。ネイティブアプリではユーザーID「${created.email}」とパスワードでログインしてください。`,
  });
});

web.get("/profile", requireUser, (c) => {
  return c.html(profilePage(c.env.APP_NAME, c.get("user")));
});

web.post("/profile", requireUser, async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const action = String(body._action ?? "");

  if (action === "update_profile") {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!name || !email) {
      return c.html(profilePage(c.env.APP_NAME, user, undefined, "入力内容を確認してください。"), 422);
    }

    const existing = await findUserByEmail(c.env.DB, email);
    if (existing && existing.id !== user.id) {
      return c.html(
        profilePage(c.env.APP_NAME, user, undefined, "このメールアドレスは既に使われています。"),
        422,
      );
    }

    const updated = await updateUserProfile(c.env.DB, user.id, { name, email });
    return c.html(profilePage(c.env.APP_NAME, updated ?? user, "プロフィールを更新しました。"));
  }

  if (action === "update_password") {
    const current = String(body.current_password ?? "");
    const password = String(body.password ?? "");
    const confirmation = String(body.password_confirmation ?? "");

    if (!(await verifyPassword(current, user.password_hash))) {
      return c.html(
        profilePage(c.env.APP_NAME, user, undefined, "現在のパスワードが正しくありません。"),
        422,
      );
    }
    if (password.length < 8 || password !== confirmation) {
      return c.html(
        profilePage(c.env.APP_NAME, user, undefined, "新しいパスワードを確認してください。"),
        422,
      );
    }

    await updateUserPassword(c.env.DB, user.id, password);
    return c.html(profilePage(c.env.APP_NAME, user, "パスワードを更新しました。"));
  }

  if (action === "delete_account") {
    const password = String(body.password ?? "");
    if (!(await verifyPassword(password, user.password_hash))) {
      return c.html(
        profilePage(c.env.APP_NAME, user, undefined, "パスワードが正しくありません。"),
        422,
      );
    }

    const sessionId = getCookie(c, "session");
    if (sessionId) {
      await deleteSession(c.env.DB, sessionId);
    }
    await deleteUser(c.env.DB, user.id);
    deleteCookie(c, "session", { path: "/" });
    return c.redirect("/login");
  }

  return c.html(profilePage(c.env.APP_NAME, user, undefined, "不明な操作です。"), 400);
});

web.get("/up", (c) => c.text("ok"));

function isSecure(c: { req: { url: string } }): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export { web };
