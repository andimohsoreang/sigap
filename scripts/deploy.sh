#!/usr/bin/env bash
# Deploy SIGAP ke server (struktur rilis atomik, lihat docs/DEPLOY.md §4).
# Jalankan DI SERVER sebagai pengguna `deploy`:
#   REPO=git@github.com:<akun>/<repo>.git bash scripts/deploy.sh            # rilis biasa
#   REPO=... bash scripts/deploy.sh --pertama                               # instalasi pertama
# Prasyarat: server sudah disiapkan sesuai DEPLOY.md §1–3 (PHP 8.4, PostgreSQL,
# Redis, nginx, Node 22) dan /var/www/sigap/shared/.env sudah final.
set -euo pipefail

REPO="${REPO:?Isi REPO, contoh: REPO=git@github.com:akun/sigap.git}"
BRANCH="${BRANCH:-main}"
BASE="${BASE:-/var/www/sigap}"
KEEP="${KEEP:-5}"
PERTAMA=0
[[ "${1:-}" == "--pertama" ]] && PERTAMA=1

[[ -f "$BASE/shared/.env" ]] || { echo "Tidak ada $BASE/shared/.env, siapkan dulu (DEPLOY.md §3)"; exit 1; }
grep -q '^NIK_HASH_KEY=base64:' "$BASE/shared/.env" || { echo "NIK_HASH_KEY belum diisi di .env (DEPLOY.md §3)"; exit 1; }

R="$BASE/releases/$(date +%Y%m%d-%H%M%S)"
echo "==> Clone $REPO ($BRANCH) ke $R"
git clone --depth 1 --branch "$BRANCH" "$REPO" "$R"
APP="$R/sigap"
cd "$APP"
ln -s "$BASE/shared/.env" .env
rm -rf storage && ln -s "$BASE/shared/storage" storage

echo "==> Dependensi & build aset"
composer install --no-dev --optimize-autoloader --no-interaction
npm ci && npm run build && rm -rf node_modules

echo "==> Izin berkas"
sudo chown -R deploy:www-data "$R"
sudo chmod -R u=rwX,g=rX,o= "$R"
sudo chown -R www-data:www-data "$BASE/shared/storage" "$APP/bootstrap/cache"
sudo chmod -R ug=rwX,o= "$BASE/shared/storage" "$APP/bootstrap/cache"
sudo find "$BASE/shared/storage" "$APP/bootstrap/cache" -type d -exec chmod g+s {} +
sudo chown root:www-data "$BASE/shared/.env" && sudo chmod 640 "$BASE/shared/.env"

echo "==> Migrasi"
if [[ $PERTAMA -eq 1 ]]; then
  grep -q '^APP_KEY=base64:' "$BASE/shared/.env" || {
    echo "APP_KEY kosong. Jalankan: sudo -u www-data php $APP/artisan key:generate --show"
    echo "lalu tempel ke $BASE/shared/.env sebagai root, dan ulangi skrip ini."; exit 1; }
  sudo -u www-data php artisan migrate --force --seed
else
  sudo -u www-data php artisan migrate --force
fi
sudo -u www-data php artisan optimize

echo "==> Aktifkan rilis"
ln -sfn "$APP" "$BASE/current"
sudo systemctl reload php8.4-fpm
for s in sigap-queue sigap-reverb; do
  systemctl list-unit-files "$s.service" >/dev/null 2>&1 && sudo systemctl restart "$s" || true
done

if [[ $PERTAMA -eq 1 ]]; then
  echo "==> Buat akun super_admin (tidak ada akun bawaan)"
  sudo -u www-data php artisan sigap:admin
fi

echo "==> Bersihkan rilis lama (simpan $KEEP terakhir)"
ls -1dt "$BASE"/releases/*/ | tail -n +"$((KEEP + 1))" | xargs -r sudo rm -rf

echo "Selesai: $(readlink "$BASE/current")"
echo "Rollback: ln -sfn $BASE/releases/<rilis-lama>/sigap $BASE/current && sudo systemctl reload php8.4-fpm"
