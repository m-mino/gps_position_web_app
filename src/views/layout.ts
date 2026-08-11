import type { User } from "../types";

type LayoutOptions = {
  title: string;
  appName: string;
  user?: User | null;
  body: string;
  scripts?: string[];
  styles?: string[];
};

export function renderLayout(options: LayoutOptions): string {
  const { title, appName, user, body, scripts = [], styles = [] } = options;
  const nav = user
    ? `
      <nav class="nav">
        <a href="/map">マップ</a>
        <a href="/profile">プロフィール</a>
        <form method="post" action="/logout" class="inline">
          <button type="submit" class="linkish">ログアウト</button>
        </form>
      </nav>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — ${escapeHtml(appName)}</title>
  <link rel="stylesheet" href="/assets/map.css">
  ${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n")}
  <style>
    :root {
      --bg: #f3f4f6;
      --card: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --danger: #dc2626;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
      background: linear-gradient(180deg, #eef2ff 0%, var(--bg) 240px);
      color: var(--text);
      min-height: 100vh;
    }
    header.app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1.25rem;
      background: rgba(255,255,255,0.9);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(8px);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .brand { font-weight: 700; color: var(--text); text-decoration: none; }
    .nav { display: flex; gap: 1rem; align-items: center; }
    .nav a, .linkish {
      color: var(--muted);
      text-decoration: none;
      font-size: 0.95rem;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font: inherit;
    }
    .nav a:hover, .linkish:hover { color: var(--accent); }
    main { padding: 1.25rem; max-width: 80rem; margin: 0 auto; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      overflow: hidden;
    }
    .card-body { padding: 1rem; }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
    label { display: block; font-size: 0.875rem; color: var(--muted); margin-bottom: 0.25rem; }
    input, select, button.btn {
      font: inherit;
    }
    input, select {
      width: 100%;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      padding: 0.55rem 0.7rem;
      margin-bottom: 0.85rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 0.5rem;
      padding: 0.55rem 0.9rem;
      background: var(--accent);
      color: #fff;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { background: #1f2937; }
    .btn-secondary:hover { background: #111827; }
    .btn-danger { background: var(--danger); }
    .muted { color: var(--muted); font-size: 0.875rem; }
    .error { color: var(--danger); font-size: 0.875rem; margin: 0 0 0.75rem; }
    .stack { display: flex; flex-direction: column; gap: 0.75rem; }
    .row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: end; }
    .field { min-width: 10rem; }
    .inline { display: inline; margin: 0; }
    .auth-wrap { max-width: 26rem; margin: 3rem auto; }
  </style>
</head>
<body>
  <header class="app-header">
    <a class="brand" href="${user ? "/map" : "/login"}">${escapeHtml(appName)}</a>
    ${nav}
  </header>
  <main>
    ${body}
  </main>
  ${scripts.map((src) => `<script type="module" src="${src}"></script>`).join("\n")}
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
