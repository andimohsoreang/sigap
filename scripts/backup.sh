#!/usr/bin/env bash
# Backup SIGAP (Docker): dump PostgreSQL + lampiran privat + .env → deploy/docker/backups/.
# Jadwalkan harian (cron/systemd timer di host), lalu salin ke penyimpanan off-site
# (restic/rclone) — backup di server yang sama BUKAN backup. Lihat docs/DEPLOY.md §7.
#   bash scripts/backup.sh            # simpan 14 backup terakhir
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/deploy/docker"
cd "$DIR"
val() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^"(.*)"$/\1/'; }

KEEP="${KEEP:-14}"
STAMP="$(date +%F-%H%M%S)"
OUT="$DIR/backups/daily-$STAMP"
umask 077
mkdir -p "$OUT"

echo "==> Database"
docker compose exec -T db pg_dump -U "$(val DB_USERNAME)" -Fc "$(val DB_DATABASE)" > "$OUT/sigap.dump"
[[ -s "$OUT/sigap.dump" ]] || { echo "dump kosong"; exit 1; }

echo "==> Lampiran privat (volume storage)"
docker compose exec -T app tar -C /var/www/html/storage/app -czf - private > "$OUT/private.tgz"

echo "==> .env (berisi APP_KEY & NIK_HASH_KEY — tanpanya NIK terenkripsi tidak terbaca)"
cp .env "$OUT/env"

echo "==> Retensi: simpan $KEEP terakhir"
ls -1dt "$DIR"/backups/daily-* | tail -n +"$((KEEP + 1))" | xargs -r rm -rf

du -sh "$OUT"
echo "Selesai: $OUT  (salin ke off-site!)"
