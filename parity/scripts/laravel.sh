#!/usr/bin/env bash
# Target Laravel lokal (tag laravel-baseline) untuk suite paritas: SQLite terpisah,
# `sigap:e2e-setup` (migrate:fresh --seed + akun uji), lalu `php artisan serve`.
# Dipanggil playwright.config.ts bila BASE_URL tidak diisi.
set -euo pipefail

PORT="${1:?pemakaian: laravel.sh <port>}"
cd "$(dirname "$0")/../../sigap"

[ -d vendor ] || { echo "sigap/vendor belum ada: jalankan 'composer install' di sigap/" >&2; exit 1; }
[ -f .env ] || { echo "sigap/.env belum ada: 'cp .env.example .env && php artisan key:generate'" >&2; exit 1; }
[ -f public/build/manifest.json ] || { echo "aset belum dibangun: 'npm ci && npx vite build' di sigap/" >&2; exit 1; }

DB="$PWD/database/paritas.sqlite"
touch "$DB"
# Folder ini tidak ikut git (isinya di-.gitignore) pada worktree baru.
mkdir -p storage/framework/views storage/framework/cache/data storage/framework/sessions storage/logs

# Variabel lingkungan menang atas .env: data, AI, dan integrasi luar dikunci agar hasil deterministik.
export APP_ENV=local APP_URL="http://127.0.0.1:${PORT}" DB_CONNECTION=sqlite DB_DATABASE="$DB" \
    AI_ENABLED=false CACHE_STORE=database SESSION_DRIVER=database QUEUE_CONNECTION=database MAIL_MAILER=log \
    BROADCAST_CONNECTION=log RECAPTCHA_SITE_KEY= RECAPTCHA_SECRET_KEY= REVERB_APP_KEY=

php artisan sigap:e2e-setup
exec php artisan serve --host=127.0.0.1 --port="$PORT" --no-reload
