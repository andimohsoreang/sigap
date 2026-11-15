#!/usr/bin/env bash
# Target Laravel lokal (tag laravel-baseline) untuk suite paritas, dengan konfigurasi cermin produksi
# dari env/laravel.env: build aset, PostgreSQL cc_paritas, `sigap:e2e-setup`, lalu `php artisan serve`.
# Dipanggil playwright.config.ts bila BASE_URL tidak diisi (satu-satunya cara menyalakan target Laravel).
set -euo pipefail

PORT="${1:?pemakaian: laravel.sh <port>}"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/env/laravel.env"
cd "$(dirname "$0")/../../sigap"

gagal() { echo "laravel.sh: $*" >&2; exit 1; }

[ -d vendor ] || gagal "sigap/vendor belum ada: jalankan 'composer install' di sigap/"
[ -d node_modules ] || gagal "sigap/node_modules belum ada: jalankan 'npm ci' di sigap/"
# Port terpakai = biasanya server yatim dari run sebelumnya; jangan diam-diam diuji ke server itu.
if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
    gagal "port ${PORT} sudah dipakai (server sisa run sebelumnya?): lsof -ti tcp:${PORT} | xargs kill"
fi
# public/hot membuat @vite memuat dari server dev, bukan build.
[ -e public/hot ] && gagal "sigap/public/hot ada (vite dev aktif?): hentikan 'npm run dev' lalu hapus berkas itu"

# Acuan harus persis tag laravel-baseline (kecuali perintah fixture cc: dan README).
git rev-parse -q --verify 'laravel-baseline^{commit}' >/dev/null || gagal "tag laravel-baseline tidak ada: git fetch --tags"
EXCLUDE=(':(exclude)app/Console/Commands/Cc' ':(exclude)README.md')
git diff --quiet laravel-baseline -- . "${EXCLUDE[@]}" || gagal "sigap/ berbeda dari laravel-baseline:
$(git diff --stat laravel-baseline -- . "${EXCLUDE[@]}")"
UNTRACKED="$(git ls-files --others --exclude-standard -- . "${EXCLUDE[@]}")"
[ -z "$UNTRACKED" ] || gagal "berkas tak terlacak di sigap/ (bukan bagian laravel-baseline):
$UNTRACKED"

# Variabel lingkungan menang atas sigap/.env (Dotenv immutable), jadi nilai di sini yang berlaku.
set -a
# shellcheck source=../env/laravel.env
. "$ENV_FILE"
set +a
# Kunci acak per run (bukan rahasia produksi); dipakai bersama oleh setup & server.
APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
NIK_HASH_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
APP_URL="http://127.0.0.1:${PORT}"
export APP_KEY NIK_HASH_KEY APP_URL

# VITE_* ditanam saat build: build ulang dengan nilai produksi di atas.
npx vite build --logLevel error

# Folder ini tidak ikut git (isinya di-.gitignore) pada worktree baru.
mkdir -p storage/framework/views storage/framework/cache/data storage/framework/sessions storage/logs
php artisan config:clear >/dev/null
php artisan view:clear >/dev/null

# sigap:e2e-setup (migrate:fresh --seed + akun uji) hanya mau jalan di APP_ENV local/testing; server tetap production.
APP_ENV=local php artisan sigap:e2e-setup

# Server + worker `php -S` dimatikan saat skrip berhenti (sinyal dari Playwright, Ctrl+C) atau saat
# proses induk (runner Playwright) hilang tanpa sinyal, agar tidak ada server yatim di port ini.
php artisan serve --host=127.0.0.1 --port="$PORT" --no-reload &
SERVER=$!
PARENT=$PPID
berhenti() {
    trap - EXIT INT TERM HUP
    pkill -TERM -P "$SERVER" 2>/dev/null || true
    kill -TERM "$SERVER" 2>/dev/null || true
    pkill -TERM -f "php -S 127.0.0.1:${PORT} " 2>/dev/null || true
}
trap berhenti EXIT INT TERM HUP
while kill -0 "$SERVER" 2>/dev/null && kill -0 "$PARENT" 2>/dev/null; do sleep 2; done
