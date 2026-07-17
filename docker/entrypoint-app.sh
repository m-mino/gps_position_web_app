#!/bin/sh
set -e
cd /var/www || exit 1

mkdir -p storage/framework/sessions \
  storage/framework/views \
  storage/framework/cache/data \
  storage/logs \
  bootstrap/cache \
  /tmp/laravel-views

# Windows バインドや root 所有ファイルで touch()/utime が失敗しないよう、書き込み可能にする
chmod -R a+rwX storage bootstrap/cache /tmp/laravel-views 2>/dev/null || true
# 既存の root 所有コンパイル済みビューを www-data で更新できるよう所有者を揃える
chown -R www-data:www-data storage/framework/views /tmp/laravel-views 2>/dev/null || true

# vendor は名前付きボリュームのためホストの ./vendor とは別。ホストからコピー不要。
# composer.json があれば autoload が無いときだけインストール（artisan の有無は問わない）
if [ -f composer.json ] && [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist --no-progress
fi

exec docker-php-entrypoint "$@"
