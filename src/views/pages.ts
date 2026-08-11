import type { User } from "../types";
import type { TableBrowseResult, TableSummary } from "../services/tables";
import type { GpsUserSummary } from "../services/users";
import { escapeHtml, renderLayout } from "./layout";

export function loginPage(appName: string, error?: string): string {
  return renderLayout({
    title: "ログイン",
    appName,
    body: `
      <div class="auth-wrap card">
        <div class="card-body">
          <h1>ログイン</h1>
          <p class="muted">メールアドレスとパスワードでサインインします。</p>
          ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
          <form method="post" action="/login">
            <label for="email">メール</label>
            <input id="email" name="email" type="email" required autocomplete="username">
            <label for="password">パスワード</label>
            <input id="password" name="password" type="password" required autocomplete="current-password">
            <button class="btn" type="submit">ログイン</button>
          </form>
          <p class="muted" style="margin-top:1rem">
            アカウントがない場合は <a href="/register">新規登録</a>
          </p>
        </div>
      </div>`,
  });
}

export function registerPage(appName: string, error?: string): string {
  return renderLayout({
    title: "新規登録",
    appName,
    body: `
      <div class="auth-wrap card">
        <div class="card-body">
          <h1>新規登録</h1>
          <p class="muted">登録したメール（ユーザーID）とパスワードで、ネイティブアプリからもログインできます。</p>
          ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
          <form method="post" action="/register">
            <label for="name">表示名</label>
            <input id="name" name="name" type="text" required>
            <label for="email">ユーザーID（メール）</label>
            <input id="email" name="email" type="email" required autocomplete="username">
            <label for="password">パスワード</label>
            <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password">
            <label for="password_confirmation">パスワード（確認）</label>
            <input id="password_confirmation" name="password_confirmation" type="password" required minlength="8" autocomplete="new-password">
            <button class="btn" type="submit">登録</button>
          </form>
          <p class="muted" style="margin-top:1rem">
            すでにアカウントがある場合は <a href="/login">ログイン</a>
          </p>
        </div>
      </div>`,
  });
}

function formatTokyo(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function gpsUsersPage(
  appName: string,
  viewer: User,
  users: GpsUserSummary[],
  options?: {
    message?: string;
    error?: string;
    form?: Partial<{ name: string; email: string }>;
    openUserId?: number;
  },
): string {
  const message = options?.message;
  const error = options?.error;
  const form = options?.form ?? {};
  const openUserId = options?.openUserId;

  const rows =
    users.length === 0
      ? `<p class="muted">まだGPSユーザーが登録されていません。</p>`
      : `<div class="user-list">${users
          .map((u) => {
            const latest = u.latest;
            const summary = latest
              ? `最終受信: ${escapeHtml(formatTokyo(latest.recorded_at))}`
              : "位置情報未受信";
            const details = latest
              ? `
                <dl class="user-meta">
                  <div><dt>緯度</dt><dd>${latest.latitude}</dd></div>
                  <div><dt>経度</dt><dd>${latest.longitude}</dd></div>
                  <div><dt>精度</dt><dd>${latest.accuracy == null ? "—" : `${latest.accuracy} m`}</dd></div>
                  <div><dt>計測時刻</dt><dd>${escapeHtml(formatTokyo(latest.recorded_at))}</dd></div>
                </dl>
                <p class="muted"><a href="/map">マップで確認</a></p>`
              : `<p class="muted">ネイティブアプリから位置情報が送信されると、ここに展開表示されます。</p>`;
            const isSelf = u.id === viewer.id;
            const openAttr = openUserId === u.id ? " open" : "";

            return `
              <details class="user-item"${openAttr}>
                <summary>
                  <span class="user-item-main">
                    <strong>${escapeHtml(u.name)}</strong>
                    <span class="muted">ID ${u.id} · ${escapeHtml(u.email)}</span>
                  </span>
                  <span class="muted user-item-status">${summary}</span>
                </summary>
                <div class="user-item-body">
                  <dl class="user-meta">
                    <div><dt>ユーザーID</dt><dd>${escapeHtml(u.email)}</dd></div>
                    <div><dt>表示名</dt><dd>${escapeHtml(u.name)}</dd></div>
                    <div><dt>登録日時</dt><dd>${escapeHtml(formatTokyo(u.created_at))}</dd></div>
                  </dl>
                  <h2 class="subheading">端末からの最新情報</h2>
                  ${details}
                  <h2 class="subheading">パスワード変更</h2>
                  <p class="muted">ネイティブアプリ用のログインパスワードを再設定します。</p>
                  <form method="post" action="/users" class="inline-actions">
                    <input type="hidden" name="_action" value="update_password">
                    <input type="hidden" name="user_id" value="${u.id}">
                    <div>
                      <label for="password-${u.id}">新しいパスワード</label>
                      <input id="password-${u.id}" name="password" type="password" required minlength="8" autocomplete="new-password">
                    </div>
                    <div>
                      <label for="password_confirmation-${u.id}">新しいパスワード（確認）</label>
                      <input id="password_confirmation-${u.id}" name="password_confirmation" type="password" required minlength="8" autocomplete="new-password">
                    </div>
                    <div class="register-actions">
                      <button class="btn btn-secondary" type="submit">パスワードを更新</button>
                    </div>
                  </form>
                  <h2 class="subheading">ユーザー削除</h2>
                  ${
                    isSelf
                      ? `<p class="muted">自分自身のアカウントはこの画面からは削除できません。</p>`
                      : `
                  <p class="muted">削除すると位置情報・APIトークンもあわせて削除されます。</p>
                  <form method="post" action="/users" onsubmit="return confirm('このユーザーを削除しますか？位置情報とAPIトークンも削除され、取り消せません。')">
                    <input type="hidden" name="_action" value="delete_user">
                    <input type="hidden" name="user_id" value="${u.id}">
                    <button class="btn btn-danger" type="submit">このユーザーを削除</button>
                  </form>`
                  }
                </div>
              </details>`;
          })
          .join("")}</div>`;

  return renderLayout({
    title: "GPSユーザー",
    appName,
    user: viewer,
    body: `
      <div class="stack" style="gap:1.25rem">
        <div class="card">
          <div class="card-body">
            <h1>GPSユーザー登録</h1>
            <p class="muted">ここで登録したユーザーID（メール）とパスワードで、ネイティブアプリがログインし位置情報を送信します。</p>
            ${message ? `<p class="success">${escapeHtml(message)}</p>` : ""}
            ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
            <form method="post" action="/users" class="register-grid">
              <input type="hidden" name="_action" value="create_user">
              <div>
                <label for="name">表示名</label>
                <input id="name" name="name" type="text" required value="${escapeHtml(form.name ?? "")}" placeholder="例: 配送車A">
              </div>
              <div>
                <label for="email">ユーザーID（メール）</label>
                <input id="email" name="email" type="email" required value="${escapeHtml(form.email ?? "")}" placeholder="device-a@example.com" autocomplete="off">
              </div>
              <div>
                <label for="password">パスワード</label>
                <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password">
              </div>
              <div>
                <label for="password_confirmation">パスワード（確認）</label>
                <input id="password_confirmation" name="password_confirmation" type="password" required minlength="8" autocomplete="new-password">
              </div>
              <div class="register-actions">
                <button class="btn" type="submit">ユーザーを登録</button>
              </div>
            </form>
          </div>
        </div>
        <div class="card">
          <div class="card-body stack">
            <div>
              <h1>登録済みユーザー</h1>
              <p class="muted">行を開くと、最新情報の確認・パスワード変更・削除ができます。</p>
            </div>
            ${rows}
          </div>
        </div>
      </div>
      <style>
        .success { color: #047857; font-size: 0.875rem; margin: 0 0 0.75rem; }
        .subheading { font-size: 1rem; margin: 1rem 0 0.5rem; }
        .register-grid, .inline-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
          gap: 0.5rem 1rem;
          align-items: end;
        }
        .register-actions { display: flex; align-items: end; padding-bottom: 0.85rem; }
        .user-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .user-item {
          border: 1px solid var(--border);
          border-radius: 0.65rem;
          background: #fafafa;
          overflow: hidden;
        }
        .user-item > summary {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 0.5rem 1rem;
          align-items: center;
          padding: 0.85rem 1rem;
          cursor: pointer;
          list-style: none;
        }
        .user-item > summary::-webkit-details-marker { display: none; }
        .user-item-main { display: flex; flex-direction: column; gap: 0.15rem; }
        .user-item-status { font-size: 0.85rem; }
        .user-item-body {
          padding: 0 1rem 1rem;
          border-top: 1px solid var(--border);
          background: #fff;
        }
        .user-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
          gap: 0.65rem 1rem;
          margin: 0.85rem 0 0;
        }
        .user-meta dt { font-size: 0.75rem; color: var(--muted); margin: 0; }
        .user-meta dd { margin: 0.15rem 0 0; font-size: 0.95rem; word-break: break-all; }
      </style>`,
  });
}

export function dataTablesPage(
  appName: string,
  viewer: User,
  summaries: TableSummary[],
  browse: TableBrowseResult,
  users: Array<{ id: number; name: string; email: string }>,
): string {
  const queryBase = (overrides: Record<string, string | number | undefined | null>) => {
    const params = new URLSearchParams();
    params.set("table", String(overrides.table ?? browse.table));
    const page = overrides.page ?? browse.page;
    if (page && Number(page) > 1) {
      params.set("page", String(page));
    }
    const userId = overrides.user_id === undefined ? browse.userId : overrides.user_id;
    if (userId != null && userId !== "") {
      params.set("user_id", String(userId));
    }
    return `/tables?${params.toString()}`;
  };

  const tabs = summaries
    .map((summary) => {
      const active = summary.name === browse.table;
      return `
        <a
          class="table-tab${active ? " is-active" : ""}"
          href="${escapeHtml(queryBase({ table: summary.name, page: 1, user_id: null }))}"
        >
          <strong>${escapeHtml(summary.label)}</strong>
          <span class="muted">${summary.count.toLocaleString("ja-JP")} 件</span>
        </a>`;
    })
    .join("");

  const userFilter = browse.filterableByUser
    ? `
      <form method="get" action="/tables" class="row table-filter">
        <input type="hidden" name="table" value="${escapeHtml(browse.table)}">
        <div class="field">
          <label for="user_id">ユーザー絞り込み</label>
          <select id="user_id" name="user_id" onchange="this.form.submit()">
            <option value="">すべてのユーザー</option>
            ${users
              .map(
                (u) => `
              <option value="${u.id}"${browse.userId === u.id ? " selected" : ""}>
                ${escapeHtml(u.name)} (ID ${u.id} · ${escapeHtml(u.email)})
              </option>`,
              )
              .join("")}
          </select>
        </div>
        <button class="btn btn-secondary" type="submit">絞り込む</button>
      </form>`
    : "";

  const tableBody =
    browse.rows.length === 0
      ? `<p class="muted">該当するレコードはありません。</p>`
      : `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>${browse.columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${browse.rows
                .map(
                  (row) => `
                <tr>
                  ${browse.columns
                    .map((col) => `<td>${escapeHtml(row[col] ?? "")}</td>`)
                    .join("")}
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>`;

  const from = browse.total === 0 ? 0 : (browse.page - 1) * browse.perPage + 1;
  const to = Math.min(browse.page * browse.perPage, browse.total);
  const prevHref =
    browse.page > 1 ? queryBase({ page: browse.page - 1 }) : null;
  const nextHref =
    browse.page < browse.totalPages ? queryBase({ page: browse.page + 1 }) : null;

  return renderLayout({
    title: "データテーブル",
    appName,
    user: viewer,
    body: `
      <div class="stack" style="gap:1.25rem">
        <div class="card">
          <div class="card-body stack">
            <div>
              <h1>データテーブル</h1>
              <p class="muted">D1 に保存されているテーブルの内容を確認します。パスワードやトークンのハッシュは表示しません。</p>
            </div>
            <div class="table-tabs">${tabs}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-body stack">
            <div class="row" style="justify-content:space-between;align-items:flex-start">
              <div>
                <h1>${escapeHtml(browse.label)}</h1>
                <p class="muted">${escapeHtml(browse.description)} · ${browse.total.toLocaleString("ja-JP")} 件中 ${from.toLocaleString("ja-JP")}–${to.toLocaleString("ja-JP")} 件</p>
              </div>
            </div>
            ${userFilter}
            ${tableBody}
            <div class="row" style="justify-content:space-between;align-items:center">
              <p class="muted">${browse.page} / ${browse.totalPages} ページ（${browse.perPage} 件ずつ）</p>
              <div class="row">
                ${
                  prevHref
                    ? `<a class="btn btn-secondary" href="${escapeHtml(prevHref)}">前へ</a>`
                    : `<button class="btn btn-secondary" type="button" disabled>前へ</button>`
                }
                ${
                  nextHref
                    ? `<a class="btn btn-secondary" href="${escapeHtml(nextHref)}">次へ</a>`
                    : `<button class="btn btn-secondary" type="button" disabled>次へ</button>`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>
        .table-tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
          gap: 0.5rem;
        }
        .table-tab {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.75rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: 0.65rem;
          text-decoration: none;
          color: inherit;
          background: #fafafa;
        }
        .table-tab:hover { border-color: #c7d2fe; }
        .table-tab.is-active {
          border-color: var(--accent);
          background: #eef2ff;
        }
        .table-filter { margin: 0; }
        .table-filter .field { min-width: 16rem; flex: 1; }
        .table-filter select { margin-bottom: 0; }
        .data-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 0.65rem; }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .data-table th, .data-table td {
          padding: 0.55rem 0.7rem;
          border-bottom: 1px solid var(--border);
          text-align: left;
          vertical-align: top;
        }
        .data-table th {
          background: #f9fafb;
          color: var(--muted);
          font-weight: 600;
          position: sticky;
          top: 0;
        }
        .data-table tbody tr:last-child td { border-bottom: none; }
        .data-table tbody tr:hover { background: #f8fafc; }
        a.btn { text-decoration: none; }
      </style>`,
  });
}

export function mapPage(appName: string, user: User): string {
  return renderLayout({
    title: "位置情報マップ",
    appName,
    user,
    scripts: ["/assets/map.js"],
    body: `
      <div class="card">
        <div class="card-body stack">
          <div class="row" style="justify-content:space-between;align-items:flex-start">
            <div>
              <h1>位置情報マップ</h1>
              <p class="muted">全ユーザーの現在地を表示します（受信時に更新 / 30秒ポーリング）</p>
              <p id="self-location-status" class="muted">自分の現在地: 未取得</p>
            </div>
            <button type="button" id="share-location-btn" class="btn">自分の現在地を共有</button>
          </div>
          <div class="row">
            <div class="field">
              <label for="history-user">移動履歴（ユーザー）</label>
              <select id="history-user">
                <option value="">表示しない</option>
              </select>
            </div>
            <div class="field">
              <label for="history-from">開始日</label>
              <input type="date" id="history-from">
            </div>
            <div class="field">
              <label for="history-to">終了日</label>
              <input type="date" id="history-to">
            </div>
            <button type="button" id="history-apply-btn" class="btn btn-secondary">履歴を表示</button>
            <p id="history-status" class="muted"></p>
          </div>
        </div>
        <div
          id="map"
          style="width:100%;height:70vh;min-height:400px"
          data-current-user-id="${user.id}"
          data-current-user-name="${escapeHtml(user.name)}"
        ></div>
      </div>`,
  });
}

export function profilePage(
  appName: string,
  user: User,
  message?: string,
  error?: string,
): string {
  return renderLayout({
    title: "プロフィール",
    appName,
    user,
    body: `
      <div class="card" style="max-width:40rem">
        <div class="card-body">
          <h1>プロフィール</h1>
          ${message ? `<p class="muted">${escapeHtml(message)}</p>` : ""}
          ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
          <form method="post" action="/profile">
            <input type="hidden" name="_action" value="update_profile">
            <label for="name">名前</label>
            <input id="name" name="name" type="text" required value="${escapeHtml(user.name)}">
            <label for="email">メール</label>
            <input id="email" name="email" type="email" required value="${escapeHtml(user.email)}">
            <button class="btn" type="submit">保存</button>
          </form>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0">
          <h1>パスワード変更</h1>
          <form method="post" action="/profile">
            <input type="hidden" name="_action" value="update_password">
            <label for="current_password">現在のパスワード</label>
            <input id="current_password" name="current_password" type="password" required>
            <label for="password">新しいパスワード</label>
            <input id="password" name="password" type="password" required minlength="8">
            <label for="password_confirmation">新しいパスワード（確認）</label>
            <input id="password_confirmation" name="password_confirmation" type="password" required minlength="8">
            <button class="btn" type="submit">パスワードを更新</button>
          </form>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0">
          <h1>アカウント削除</h1>
          <form method="post" action="/profile" onsubmit="return confirm('本当に削除しますか？')">
            <input type="hidden" name="_action" value="delete_account">
            <label for="delete_password">確認のためパスワード</label>
            <input id="delete_password" name="password" type="password" required>
            <button class="btn btn-danger" type="submit">アカウントを削除</button>
          </form>
        </div>
      </div>`,
  });
}

export function accessRequiredPage(appName: string): string {
  return renderLayout({
    title: "認証が必要です",
    appName,
    body: `
      <div class="auth-wrap card">
        <div class="card-body">
          <h1>Cloudflare Access が必要です</h1>
          <p class="muted">このアプリは Cloudflare Access で保護されています。Access 経由でアクセスしてください。</p>
        </div>
      </div>`,
  });
}
