import type { User } from "../types";
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
          ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
          <form method="post" action="/register">
            <label for="name">名前</label>
            <input id="name" name="name" type="text" required>
            <label for="email">メール</label>
            <input id="email" name="email" type="email" required>
            <label for="password">パスワード</label>
            <input id="password" name="password" type="password" required minlength="8">
            <label for="password_confirmation">パスワード（確認）</label>
            <input id="password_confirmation" name="password_confirmation" type="password" required minlength="8">
            <button class="btn" type="submit">登録</button>
          </form>
          <p class="muted" style="margin-top:1rem">
            すでにアカウントがある場合は <a href="/login">ログイン</a>
          </p>
        </div>
      </div>`,
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
