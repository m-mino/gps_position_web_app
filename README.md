# GPS Position Web App

GPS端末から送られる位置情報を収集し、Webブラウザの地図上で現在地・移動履歴を確認するアプリケーションです。

- **本リポジトリ**: Webアプリ（ログイン・地図）と位置受信API
- **Androidネイティブ自作**: 必須ではない（下記 OwnTracks でバックグラウンド送信可）

詳細仕様は [docs/仕様書.md](docs/仕様書.md) を参照してください。

## ローカル起動（Docker）

```powershell
docker compose up -d
docker compose exec app php artisan migrate
docker compose exec app php artisan db:seed
```

フロントエンド資産のビルド（ホストに Node がない場合）:

```powershell
docker run --rm -v "${PWD}:/app" -w /app node:22-bookworm bash -c "npm install && npm run build"
```

- Web: http://localhost:8080
- シードユーザー: `test@example.com` / `password`

## Web の使い方

1. ログインする
2. マップ画面で全ユーザーの現在地を確認（約5秒ポーリング）
3. 移動履歴はユーザー・日付を指定して表示（軌跡・滞在・方向矢印）

## バックグラウンド位置送信（推奨: OwnTracks）

Androidでバックグラウンド送信するには、自作アプリの代わりに [OwnTracks](https://owntracks.org/)（Playストア無料）を使えます。

### 設定手順

1. Playストアで **OwnTracks** をインストール
2. 設定（Preferences）を開く
3. **Mode** を `HTTP` にする
4. 次を設定する

| 項目 | 値（ローカル例） |
|------|------------------|
| Host / URL | `http://<PCのLAN IP>:8080/api/owntracks` |
| Authentication | Username / Password |
| Username | Webと同じメール（例: `walker@example.com`） |
| Password | Webと同じパスワード（例: `password`） |

5. 位置情報・バックグラウンド実行を許可する
6. 必要なら Reporting interval（報告間隔）を調整する

`localhost` は端末から見えないため、Dockerホストの LAN IP（例: `192.168.x.x`）を指定してください。本番では `https://あなたのドメイン/api/owntracks` を使います。

送信された位置は、ログインユーザー（Basic認証のメール）の位置として地図に表示されます。

### 動作確認

```powershell
curl.exe -u walker@example.com:password -H "Content-Type: application/json" -d "{\"_type\":\"location\",\"lat\":34.6805,\"lon\":134.9072,\"acc\":10,\"tst\":1720000000}" http://localhost:8080/api/owntracks
```

成功時は空配列 `[]` が返ります。

## Android / 別リポジトリ向け API

ベースURL例: `http://localhost:8080`

### 1. ログイン

`POST /api/login`

```json
{
  "email": "test@example.com",
  "password": "password",
  "device_name": "android-device-1"
}
```

レスポンスの `token` を以降のリクエストに付与します。

`Authorization: Bearer {token}`

### 2. 位置情報の送信

`POST /api/positions`

```json
{
  "latitude": 35.681236,
  "longitude": 139.767125,
  "accuracy": 12.5,
  "recorded_at": "2026-07-16T12:00:00+09:00"
}
```

`user_id` はトークンのユーザーから決定されます（クライアント指定不可）。

### 3. OwnTracks 受信

`POST /api/owntracks`（Basic認証または Bearer）

### 4. ログアウト

`POST /api/logout`（Bearer 必須）

### その他

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/positions/latest` | 全ユーザーの最新位置 |
| GET | `/api/positions?user_id=1&from=YYYY-MM-DD&to=YYYY-MM-DD` | 移動履歴 |

APIの詳細は [docs/仕様書.md](docs/仕様書.md) の「API契約」を参照してください。

## テスト

```powershell
docker compose exec app php artisan test
```

## 本番（さくらレンタルサーバー）の前提

- Docker / WebSocket / 常駐キューは前提にしない
- Laravel を PHP + MySQL でデプロイ
- HTTPS 推奨（OwnTracks の常時送信向け）
- キューは `database` ドライバ。必要なら cron で `php artisan schedule:run`
