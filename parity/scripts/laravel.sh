#!/usr/bin/env bash
# Target Laravel lokal (tag laravel-baseline) untuk suite paritas, dengan konfigurasi cermin produksi
# dari env/laravel.env: build aset, PostgreSQL cc_paritas, `sigap:e2e-setup`, lalu `php artisan serve`.
# Dipanggil playwright.config.ts bila TARGET=laravel (bawaan) dan BASE_URL kosong.
set -euo pipefail

PORT="${1:?pemakaian: laravel.sh <port>}"
# shellcheck source=umum.sh
. "$(dirname "$0")/umum.sh"
cd "$SIGAP"

[ -d node_modules ] || gagal "sigap/node_modules belum ada: jalankan 'npm ci' di sigap/"
port_bebas "$PORT"
# public/hot membuat @vite memuat dari server dev, bukan build.
[ -e public/hot ] && gagal "sigap/public/hot ada (vite dev aktif?): hentikan 'npm run dev' lalu hapus berkas itu"
cek_sigap_baseline

# Variabel lingkungan menang atas sigap/.env (Dotenv immutable), jadi nilai di sini yang berlaku.
muat_env "$PORT"

# VITE_* ditanam saat build: build ulang dengan nilai produksi di atas.
npx vite build --logLevel error

seed_laravel

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
tunggu_server "$SERVER" "$PARENT"
