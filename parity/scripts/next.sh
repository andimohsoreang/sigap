#!/usr/bin/env bash
# Target Next.js lokal untuk suite paritas: build produksi standalone (web/), data uji dari seed Laravel yang sama
# (`sigap:e2e-setup` ke database target, kunci APP_KEY/NIK_HASH_KEY acak yang juga dipakai Next.js untuk membaca
# NIK terenkripsi & hash NIK), migrasi tabel cc_* (dist/migrate.mjs), Valkey sementara, lalu `node server.js`
# dengan env seperti image deploy/next/Dockerfile + compose (tanpa rahasia; nilai realtime palsu, Sockudo tidak ada).
# Dipanggil playwright.config.ts bila TARGET=next dan BASE_URL kosong.
#   PARITAS_NEXT_BUILD=0  pakai build yang sudah ada (web/.next/standalone) — hanya bila web/ tidak berubah sejak build.
set -euo pipefail

PORT="${1:?pemakaian: next.sh <port>}"
VALKEY_PORT="$((PORT + 10000))"
# shellcheck source=umum.sh
. "$(dirname "$0")/umum.sh"
WEB="$(cd "$PARITY/../web" && pwd)"

[ -d "$WEB/node_modules" ] || gagal "web/node_modules belum ada: jalankan 'npm ci' di web/"
VALKEY_BIN="$(command -v valkey-server || command -v redis-server || true)"
[ -n "$VALKEY_BIN" ] || gagal "valkey-server/redis-server tidak ada (Next.js produksi mewajibkan VALKEY_URL)"
port_bebas "$PORT"
port_bebas "$VALKEY_PORT"
cek_sigap_baseline

# Build dengan env bersih (seperti Dockerfile): env/laravel.env (mis. LOG_LEVEL=warning) bukan env Next.js.
if [ "${PARITAS_NEXT_BUILD:-1}" != 0 ]; then
    (cd "$WEB" && env -i PATH="$PATH" HOME="$HOME" NEXT_TELEMETRY_DISABLED=1 npm run build)
fi
muat_env "$PORT"
STANDALONE="$WEB/.next/standalone/web"
[ -f "$STANDALONE/server.js" ] || gagal "build standalone tidak ada: $STANDALONE/server.js"
[ -f "$WEB/dist/migrate.mjs" ] || gagal "web/dist/migrate.mjs tidak ada (npm run build membangunnya)"
# Tata letak image (Dockerfile): public/ dan .next/static di samping server standalone.
rm -rf "$STANDALONE/public" "$STANDALONE/.next/static"
cp -R "$WEB/public" "$STANDALONE/public"
cp -R "$WEB/.next/static" "$STANDALONE/.next/static"

seed_laravel
DB_URL="postgres://${DB_USERNAME}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}"
# migrate:fresh menghapus tabel cc_*; pasang lagi seperti service compose `migrate`.
DATABASE_URL_MIGRATE="$DB_URL" CC_MIGRASI_DIR="$WEB/drizzle-cc" node "$WEB/dist/migrate.mjs" >/dev/null

"$VALKEY_BIN" --port "$VALKEY_PORT" --bind 127.0.0.1 --save '' --appendonly no >/dev/null &
VALKEY=$!

# env -i: hanya nilai di bawah yang berlaku (bukan .env pengembang). Nilai dari env/laravel.env = cermin produksi.
# DB_USERNAME cc_migrate (lokal); produksi cc_app lewat PgBouncer — tidak mengubah tampilan.
cd "$STANDALONE"
env -i PATH="$PATH" HOME="$HOME" \
    NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=Asia/Jakarta PORT="$PORT" HOSTNAME=127.0.0.1 \
    APP_URL="$APP_URL" APP_KEY="$APP_KEY" NIK_HASH_KEY="$NIK_HASH_KEY" LOG_LEVEL=warn \
    DATABASE_URL="$DB_URL" VALKEY_URL="redis://127.0.0.1:${VALKEY_PORT}/0" \
    REALTIME_APP_ID=paritas REALTIME_APP_KEY=paritas-kunci REALTIME_APP_SECRET=paritas-bukan-rahasia \
    SESSION_LIFETIME="$SESSION_LIFETIME" RECAPTCHA_SITE_KEY="$RECAPTCHA_SITE_KEY" \
    AI_ENABLED="$AI_ENABLED" AI_SERVICE_LABEL="$AI_SERVICE_LABEL" \
    node server.js &
SERVER=$!
PARENT=$PPID
berhenti() {
    trap - EXIT INT TERM HUP
    kill -TERM "$SERVER" "$VALKEY" 2>/dev/null || true
}
trap berhenti EXIT INT TERM HUP
tunggu_server "$SERVER" "$PARENT"
