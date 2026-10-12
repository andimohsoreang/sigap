#!/usr/bin/env bash
# Deploy SIGAP dengan Docker Compose (lihat docs/DEPLOY.md).
# Jalankan DI SERVER, dari clone repo ini, sebagai user yang boleh menjalankan docker:
#   bash scripts/deploy.sh --pertama     # instalasi pertama (migrate + seed + buat super_admin)
#   bash scripts/deploy.sh               # rilis biasa (git pull → build → backup DB → migrate → up)
#   bash scripts/deploy.sh --no-pull     # pakai kode yang sudah ada di folder (tanpa git pull)
#   bash scripts/deploy.sh --rollback    # kembali ke image rilis sebelumnya (tag :prev)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/deploy/docker"
cd "$DIR"

PERTAMA=0; PULL=1; ROLLBACK=0
for a in "$@"; do
  case "$a" in
    --pertama) PERTAMA=1 ;;
    --no-pull) PULL=0 ;;
    --rollback) ROLLBACK=1 ;;
    *) echo "Opsi tidak dikenal: $a"; exit 2 ;;
  esac
done

die() { echo "GAGAL: $*" >&2; exit 1; }
# Kunci yang tidak ada di .env menghasilkan string kosong (grep exit 1 + pipefail tidak boleh mematikan skrip).
val() { { grep -E "^$1=" .env || true; } | tail -n1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^"(.*)"$/\1/'; }

[[ -f .env ]] || die "deploy/docker/.env belum ada. Salin dari .env.example lalu isi (docs/DEPLOY.md §3)."
for k in APP_KEY NIK_HASH_KEY DB_PASSWORD REVERB_APP_KEY REVERB_APP_SECRET APP_URL; do
  [[ -n "$(val "$k")" ]] || die "$k kosong di .env"
done
[[ "$(val REVERB_APP_KEY)" == "$(val VITE_REVERB_APP_KEY)" ]] || die "VITE_REVERB_APP_KEY harus sama dengan REVERB_APP_KEY"
[[ "$(val APP_DEBUG)" == "false" ]] || die "APP_DEBUG harus false"
chmod 600 .env
if [[ -z "$(val RECAPTCHA_SECRET_KEY)" || -z "$(val RECAPTCHA_SITE_KEY)" ]]; then
  echo "PERINGATAN: RECAPTCHA_SITE_KEY/RECAPTCHA_SECRET_KEY kosong — di production pengaduan publik," >&2
  echo "            survei, dan chat tamu akan DITOLAK (fail closed). Lihat docs/DEPLOY.md §3." >&2
fi

WEB_PORT="$(val WEB_PORT)"; WEB_PORT="${WEB_PORT:-8092}"
DB_USER="$(val DB_USERNAME)"; DB_NAME="$(val DB_DATABASE)"
IMG_APP="$(val SIGAP_IMAGE)"; IMG_APP="${IMG_APP:-sigap-app}"
IMG_WEB="$(val SIGAP_WEB_IMAGE)"; IMG_WEB="${IMG_WEB:-sigap-web}"
DC=(docker compose)

health() {
  echo "==> Cek kesehatan http://127.0.0.1:$WEB_PORT/up"
  for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$WEB_PORT/up"; then echo "OK"; return 0; fi
    sleep 2
  done
  "${DC[@]}" ps; "${DC[@]}" logs --tail=50 app web
  die "aplikasi tidak sehat"
}

if [[ $ROLLBACK -eq 1 ]]; then
  docker image inspect "$IMG_APP:prev" >/dev/null 2>&1 || die "tidak ada image $IMG_APP:prev"
  echo "==> Rollback ke image :prev (migrasi database TIDAK dibatalkan — lihat DEPLOY.md §8)"
  docker tag "$IMG_APP:prev" "$IMG_APP:latest"
  docker tag "$IMG_WEB:prev" "$IMG_WEB:latest"
  "${DC[@]}" up -d --no-build --remove-orphans
  health
  exit 0
fi

if [[ $PULL -eq 1 ]]; then
  echo "==> git pull"
  git -C "$ROOT" pull --ff-only
fi
echo "==> Versi: $(git -C "$ROOT" log -1 --format='%h %s' 2>/dev/null || echo '-')"

echo "==> Simpan image lama sebagai :prev (untuk rollback)"
for img in "$IMG_APP" "$IMG_WEB"; do
  docker image inspect "$img:latest" >/dev/null 2>&1 && docker tag "$img:latest" "$img:prev" || true
done

echo "==> Build image"
"${DC[@]}" build --pull

echo "==> Database"
"${DC[@]}" up -d --wait db

if [[ $PERTAMA -eq 0 ]]; then
  mkdir -p "$DIR/backups" && chmod 700 "$DIR/backups"
  DUMP="$DIR/backups/pre-migrate-$(date +%F-%H%M%S).dump"
  echo "==> Backup sebelum migrasi: $DUMP"
  "${DC[@]}" exec -T db pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$DUMP"
  chmod 600 "$DUMP"
  [[ -s "$DUMP" ]] || die "backup kosong"
fi

echo "==> Migrasi"
if [[ $PERTAMA -eq 1 ]]; then
  "${DC[@]}" run --rm --no-deps app php artisan migrate --force --seed
else
  "${DC[@]}" run --rm --no-deps app php artisan migrate --force
fi

echo "==> Jalankan stack"
"${DC[@]}" up -d --remove-orphans --wait
health

if [[ $PERTAMA -eq 1 ]]; then
  echo "==> Buat akun super_admin (tidak ada akun bawaan)"
  "${DC[@]}" exec app php artisan sigap:admin
fi

echo "==> Bersihkan image & backup lama"
docker image prune -f >/dev/null
ls -1t "$DIR"/backups/pre-migrate-*.dump 2>/dev/null | tail -n +11 | xargs -r rm -f

echo "Selesai. Rollback bila perlu: bash scripts/deploy.sh --rollback"
