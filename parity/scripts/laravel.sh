#!/usr/bin/env bash
# Target Laravel lokal (tag laravel-baseline) untuk suite paritas, dengan konfigurasi cermin produksi
# dari env/laravel.env: build aset, SQLite terpisah, `sigap:e2e-setup`, lalu `php artisan serve`.
# Dipanggil playwright.config.ts bila BASE_URL tidak diisi.
set -euo pipefail

PORT="${1:?pemakaian: laravel.sh <port>}"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/env/laravel.env"
cd "$(dirname "$0")/../../sigap"

[ -d vendor ] || { echo "sigap/vendor belum ada: jalankan 'composer install' di sigap/" >&2; exit 1; }
[ -d node_modules ] || { echo "sigap/node_modules belum ada: jalankan 'npm ci' di sigap/" >&2; exit 1; }

# Variabel lingkungan menang atas sigap/.env (Dotenv immutable), jadi nilai di sini yang berlaku.
set -a
# shellcheck source=../env/laravel.env
. "$ENV_FILE"
set +a
# Kunci acak per run (bukan rahasia produksi); dipakai bersama oleh setup & server.
APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
NIK_HASH_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
APP_URL="http://127.0.0.1:${PORT}"
DB_DATABASE="$PWD/database/paritas.sqlite"
export APP_KEY NIK_HASH_KEY APP_URL DB_DATABASE

# VITE_* ditanam saat build: build ulang dengan nilai produksi di atas.
npx vite build --logLevel error

touch "$DB_DATABASE"
# Folder ini tidak ikut git (isinya di-.gitignore) pada worktree baru.
mkdir -p storage/framework/views storage/framework/cache/data storage/framework/sessions storage/logs
php artisan view:clear >/dev/null

# sigap:e2e-setup hanya mau jalan di APP_ENV local/testing; server tetap production.
APP_ENV=local php artisan sigap:e2e-setup
exec php artisan serve --host=127.0.0.1 --port="$PORT" --no-reload
