# GPS Position Web App

GPS端末から送られる位置情報を収集し、Webブラウザの地図上で現在地・移動履歴を確認するアプリケーションです。

- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono
- **データベース**: Cloudflare D1
- **認証**: Cloudflare Access（本番） / セッション認証（ローカル）

詳細仕様は [docs/仕様書.md](docs/仕様書.md) を参照してください。

## ローカル起動

前提: Node.js 20+、Cloudflare アカウント（リモートデプロイ時）

```powershell
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

- Web: http://localhost:8787
- シードユーザー: `test@example.com` / `password`
- 更新方式: 最新位置APIの **30秒ポーリング**（Workers では Reverb 相当の常駐WSは使わない）

## Web の使い方

1. ログインする（ローカルはメール/パスワード）
2. マップ画面で全ユーザーの現在地を確認
3. 移動履歴はユーザー・日付を指定して表示（軌跡・滞在・方向矢印）
4. データテーブル画面で `users` / `positions` / `api_tokens` / `sessions` の中身を確認

## 認証モード

| モード | 設定 | 用途 |
|--------|------|------|
| `session` | `AUTH_MODE=session`（デフォルト） | ローカル開発。Cookie セッション |
| `access` | `AUTH_MODE=access` + `CF_ACCESS_TEAM_NAME` | 本番。Cloudflare Access JWT |

本番では Cloudflare Zero Trust でアプリケーションを作成し、Workers の前段（または Worker 自体）を Access で保護します。

```toml
# wrangler.toml または dashboard vars
AUTH_MODE = "access"
CF_ACCESS_TEAM_NAME = "your-team"
CF_ACCESS_AUD = "your-application-aud"
```

端末向け API（OwnTracks / `POST /api/login`）は Access をバイパスし、Basic または Bearer トークンで認証します。Cloudflare Access のポリシーで `/api/owntracks` と `/api/login` を Bypass にしてください。

## バックグラウンド位置送信（OwnTracks）

| 項目 | 値（ローカル例） |
|------|------------------|
| Host / URL | `http://127.0.0.1:8787/api/owntracks` |
| Authentication | Username / Password |
| Username | `walker@example.com` |
| Password | `password` |

```powershell
curl.exe -u walker@example.com:password -H "Content-Type: application/json" -d "{\"_type\":\"location\",\"lat\":34.6805,\"lon\":134.9072,\"acc\":10,\"tst\":1720000000}" http://127.0.0.1:8787/api/owntracks
```

### PowerShell テスト

```powershell
.\scripts\send-position.ps1 -BaseUrl http://127.0.0.1:8787
.\scripts\send-position.ps1 -BaseUrl http://127.0.0.1:8787 -Mode owntracks
```

## デプロイ

1. D1 を作成して `wrangler.toml` の `database_id` を更新

```powershell
npx wrangler d1 create gps_position
```

2. マイグレーション・シード・デプロイ

```powershell
npm run db:migrate:remote
npm run db:seed:remote   # 任意
npm run deploy
```

3. Cloudflare Access を有効化し、`AUTH_MODE=access` とチーム名 / AUD を設定

```powershell
npx wrangler secret put SESSION_SECRET
```

## API 概要

| Method | Path | Auth | 説明 |
|--------|------|------|------|
| POST | `/api/login` | なし | 端末用トークン発行 |
| POST | `/api/logout` | Bearer | トークン削除 |
| POST | `/api/positions` | Bearer/Session/Access | 位置登録 |
| GET | `/api/positions/latest` | Bearer/Session/Access | 全ユーザー最新位置 |
| GET | `/api/positions` | Bearer/Session/Access | 履歴 + 滞在 |
| POST | `/api/owntracks` | Basic or Bearer | OwnTracks 互換 |

## 開発コマンド

| コマンド | 説明 |
|----------|------|
| `npm run dev` | ローカル Worker 起動 |
| `npm test` | 単体テスト |
| `npm run typecheck` | 型チェック |
| `npm run db:migrate:local` | ローカル D1 マイグレーション |
| `npm run db:seed:local` | ローカル D1 シード |
