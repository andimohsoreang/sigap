#!/usr/bin/env bash
# Deploy stack subdomain uji Contact Center (deploy/next/compose.yml, project contact-center-uji).
# Jalankan DI SERVER, dari clone TERPISAH (usul: /opt/cc-uji), sebagai user yang boleh menjalankan docker:
#   bash scripts/deploy-uji.sh --env-baru       # sekali: buat deploy/next/.env dengan sandi & kunci acak baru
#   bash scripts/deploy-uji.sh                  # git pull → build → backup DB uji → up → cek /up
#   bash scripts/deploy-uji.sh --no-pull        # pakai kode yang sudah ada di folder (checkout detached)
#   bash scripts/deploy-uji.sh --rollback       # kembali ke image sehat sebelumnya (:uji-prev)
#   bash scripts/deploy-uji.sh --rollback=<sha> # kembali ke image commit <sha> (lihat --versi)
#   bash scripts/deploy-uji.sh --versi          # daftar tag SHA yang tersedia
#
# Image contact-center-uji (BUKAN contact-center-web, nama image produksi kelak: pembersihan tag SHA di bawah tidak
# boleh menyentuh image rollback produksi). Tag: :uji (berjalan), :uji-sehat (terakhir lulus health check),
# :uji-prev (sehat sebelum build ini = target --rollback), :<sha> (tiap build; 5 terbaru disimpan).
# Tidak pernah menyentuh /opt/app2-sigap, project app2-sigap, atau image sigap-*: compose selalu dipanggil dengan
# -p contact-center-uji -f/--env-file eksplisit, dan COMPOSE_* dari shell/.env ditolak — `--remove-orphans` di
# project yang salah akan menghapus container app2. DB uji boleh direset
# (docs/RENCANA-PER-FITUR.md §0): rollback image tidak membatalkan perubahan DB — pulihkan dari backups/ bila perlu.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/deploy/next"
PORT=8094
SIMPAN_SHA=5
PROJECT=contact-center-uji
IMG=contact-center-uji
# COMPOSE_PROJECT_NAME/COMPOSE_FILE/COMPOSE_PROFILES mengalahkan `name:` di compose.yml.
unset COMPOSE_PROJECT_NAME COMPOSE_FILE COMPOSE_PROFILES

PULL=1; ROLLBACK=0; ROLLBACK_TO=uji-prev; VERSI=0; ENV_BARU=0
for a in "$@"; do
  case "$a" in
    --no-pull) PULL=0 ;;
    --rollback) ROLLBACK=1 ;;
    --rollback=*) ROLLBACK=1; ROLLBACK_TO="${a#--rollback=}" ;;
    --versi) VERSI=1 ;;
    --env-baru) ENV_BARU=1 ;;
    *) echo "Opsi tidak dikenal: $a" >&2; exit 2 ;;
  esac
done

die() { echo "GAGAL: $*" >&2; exit 1; }
# Kunci yang tidak ada di .env menghasilkan string kosong (grep exit 1 + pipefail tidak boleh mematikan skrip).
val() { { grep -E "^$1=" "$DIR/.env" || true; } | tail -n1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^"(.*)"$/\1/'; }

# Pagar: clone ini bukan deploy Laravel produksi.
case "$ROOT" in *app2-sigap*) die "skrip ini untuk stack uji; $ROOT adalah lokasi Laravel produksi" ;; esac

# ---- .env ----
# Kunci & sandi uji selalu baru (DB uji = data seeder, bukan data produksi): jangan salin dari Laravel app2.
if [[ $ENV_BARU -eq 1 ]]; then
  [[ ! -e "$DIR/.env" ]] || die "deploy/next/.env sudah ada; tidak ditimpa"
  umask 077
  kunci() { echo "base64:$(head -c 32 /dev/urandom | base64)"; }
  hex() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  while IFS= read -r l; do
    case "$l" in
      APP_KEY=GANTI|NIK_HASH_KEY=GANTI) echo "${l%%=*}=$(kunci)" ;;
      *=GANTI) echo "${l%%=*}=$(hex)" ;;
      *) echo "$l" ;;
    esac
  done < "$DIR/.env.example" > "$DIR/.env"
  echo "deploy/next/.env dibuat (mode 600). Periksa APP_URL lalu jalankan: bash scripts/deploy-uji.sh"
  exit 0
fi
[[ -f "$DIR/.env" ]] || die "deploy/next/.env belum ada: bash scripts/deploy-uji.sh --env-baru"
! grep -qE '^[[:space:]]*(export[[:space:]]+)?COMPOSE_' "$DIR/.env" || die "deploy/next/.env tidak boleh berisi COMPOSE_* (bisa mengarahkan compose ke project lain)"
SANDI=(POSTGRES_PASSWORD CC_MIGRATE_PASSWORD CC_APP_PASSWORD CC_READONLY_PASSWORD VALKEY_PASSWORD REALTIME_APP_KEY REALTIME_APP_SECRET)
for k in "${SANDI[@]}" REALTIME_APP_ID APP_URL APP_KEY NIK_HASH_KEY; do
  v="$(val "$k")"
  [[ -n "$v" ]] || die "$k kosong di .env"
  [[ "$v" != *GANTI* ]] || die "$k masih berisi placeholder GANTI"
done
# Masuk URL koneksi & userlist PgBouncer tanpa escaping; `$` juga ditafsirkan compose.
for k in "${SANDI[@]}"; do
  [[ "$(val "$k")" =~ ^[A-Za-z0-9]{32,}$ ]] || die "$k harus ≥ 32 karakter huruf/angka (openssl rand -hex 32)"
done
[[ "$(val REALTIME_APP_ID)" =~ ^[A-Za-z0-9_-]+$ ]] || die "REALTIME_APP_ID hanya huruf/angka/_/-"
# Origin persis (Sockudo mencocokkan header Origin apa adanya; garis miring di akhir mematikan semua WebSocket).
[[ "$(val APP_URL)" =~ ^https://[^/]+$ ]] || die "APP_URL harus https://<host> tanpa path/garis miring di akhir"
# Sama dengan web/src/server/env.ts (paket E): server menolak start bila format salah.
bytes() { printf '%s' "${1#base64:}" | base64 -d 2>/dev/null | wc -c | tr -d ' '; }
k="$(val APP_KEY)"; [[ "$k" == base64:* && "$(bytes "$k")" == 32 ]] || die "APP_KEY harus base64: 32 byte (--env-baru membuatnya)"
k="$(val NIK_HASH_KEY)"
if [[ "$k" == base64:* ]]; then n="$(bytes "$k")"; else n="${#k}"; fi
[[ "$n" -ge 32 ]] || die "NIK_HASH_KEY minimal 32 byte"
# DATABASE_URL & DATABASE_URL_READONLY tidak di .env: compose.yml membentuknya dari CC_APP/READONLY_PASSWORD.
chmod 600 "$DIR/.env"

[[ "$(val CC_IMAGE)" == "$IMG" ]] || die "CC_IMAGE harus $IMG (contact-center-web dicadangkan untuk produksi)"
[[ "$(val CC_TAG)" == uji ]] || die "CC_TAG harus uji; skrip ini yang mengatur tag lain"

command -v docker >/dev/null 2>&1 || die "docker tidak ditemukan — jalankan di server"
docker info >/dev/null 2>&1 || die "tidak bisa menghubungi daemon Docker"
cd "$DIR"
DC=(docker compose -p "$PROJECT" -f "$DIR/compose.yml" --env-file "$DIR/.env")

# Sandi cc_app dibaca dari userlist DI DALAM container pgbouncer: tidak muncul di argumen proses host.
PSQL_APP='PGPASSWORD="$(sed -n "s/^\"cc_app\" \"\(.*\)\"$/\1/p" /etc/pgbouncer/userlist.txt)" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 6432 -U cc_app -d contact_center "$@"'

diagnosis() { "${DC[@]}" ps; "${DC[@]}" logs --tail=50 cc-web worker sockudo pgbouncer postgres || true; }

health() {
  # cc-web mempercayai CF-Connecting-IP (IP klien untuk rate limit & audit): aman hanya bila satu-satunya jalan masuk
  # adalah cloudflared lewat loopback. Port terbuka ke luar → siapa pun bisa memalsukan IP.
  local alamat
  alamat="$("${DC[@]}" port cc-web 3000 2>/dev/null || true)"
  [[ "$alamat" == "127.0.0.1:$PORT" ]] || { diagnosis; die "cc-web harus terbuka hanya di 127.0.0.1:$PORT (sekarang: ${alamat:-tidak ada})"; }
  echo "==> Cek kesehatan http://127.0.0.1:$PORT/up"
  local ok=0
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/up"; then ok=1; break; fi
    sleep 2
  done
  [[ $ok -eq 1 ]] || { diagnosis; die "cc-web tidak sehat — pertimbangkan: bash scripts/deploy-uji.sh --rollback"; }
  # /up tidak menyentuh DB: login sungguhan sebagai cc_app lewat PgBouncer + skema baseline lengkap.
  echo "==> Cek DB lewat PgBouncer (cc_app)"
  local n
  n="$("${DC[@]}" exec -T pgbouncer sh -c "$PSQL_APP" sh -tAc 'SELECT count(*) FROM migrations' 2>&1)" || n="galat: $n"
  if [[ "$n" != 34 ]]; then
    diagnosis
    die "DB uji tidak siap (migrations = ${n:-kosong}, harus 34). Init yang gagal tidak diulang pada volume yang sudah ada;
       reset DB uji (data hilang): ${DC[*]} down && docker volume rm ${PROJECT}_pgdata-uji, lalu deploy lagi."
  fi
  cek_worker
  echo "OK"
  docker tag "$IMG:uji" "$IMG:uji-sehat"
}

# Worker (pg-boss + outbox) tidak punya port/healthcheck: setelah ±15 dtk wajib running, belum pernah restart, dan
# log container ini memuat "worker berjalan" (dicetak setelah boss.start + jadwal terpasang). Gagal → tanpa :uji-sehat.
WORKER=1
cek_worker() {
  if [[ $WORKER -eq 0 ]]; then echo "==> Worker dilewati (image tanpa dist/worker.mjs, --scale worker=0)"; return 0; fi
  echo "==> Cek worker (tunggu 15 dtk)"
  sleep 15
  local id st
  id="$("${DC[@]}" ps -q worker 2>/dev/null || true)"
  [[ -n "$id" ]] || { diagnosis; die "container worker tidak ada"; }
  st="$(docker inspect -f '{{.State.Status}} restart={{.RestartCount}}' "$id" 2>/dev/null || true)"
  [[ "$st" == "running restart=0" ]] || { diagnosis; die "worker tidak sehat ($st)"; }
  docker logs "$id" 2>&1 | grep -q 'worker berjalan' || { diagnosis; die "log worker tidak memuat \"worker berjalan\""; }
}

versions() {
  docker images --format '{{.Repository}}:{{.Tag}}  {{.CreatedSince}}' "$IMG" | grep -E ":[0-9a-f]{7,40} " || true
}

if [[ $VERSI -eq 1 ]]; then
  echo "Tag SHA yang tersedia (terbaru di atas):"; versions; exit 0
fi

# Sandi role apa adanya (sudah dicek huruf/angka): PgBouncer memakainya untuk SCRAM ke klien & PostgreSQL.
# Mode 644 karena dibaca uid 70 di container; host dilindungi folder deploy/next yang dibuat 700.
chmod 700 "$DIR"
{
  printf '"cc_app" "%s"\n' "$(val CC_APP_PASSWORD)"
  printf '"cc_readonly" "%s"\n' "$(val CC_READONLY_PASSWORD)"
  printf '"cc_migrate" "%s"\n' "$(val CC_MIGRATE_PASSWORD)"
} > pgbouncer/userlist.txt.baru
chmod 644 pgbouncer/userlist.txt.baru && mv pgbouncer/userlist.txt.baru pgbouncer/userlist.txt

if [[ $ROLLBACK -eq 1 ]]; then
  [[ "$ROLLBACK_TO" =~ ^(uji-prev|[0-9a-f]{7,40})$ ]] || die "tag rollback tidak sah: $ROLLBACK_TO"
  docker image inspect "$IMG:$ROLLBACK_TO" >/dev/null 2>&1 || { versions; die "tidak ada image $IMG:$ROLLBACK_TO"; }
  echo "==> Rollback ke $IMG:$ROLLBACK_TO (DB uji TIDAK dikembalikan — pulihkan dari deploy/next/backups bila perlu)"
  # Image sebelum paket G tidak berisi worker: jalankan tanpa worker (bukan crash-loop `node dist/worker.mjs`).
  SKALA=()
  if ! docker run --rm --network none --entrypoint test "$IMG:$ROLLBACK_TO" -f /app/dist/worker.mjs; then
    WORKER=0; SKALA=(--scale worker=0)
  fi
  docker tag "$IMG:$ROLLBACK_TO" "$IMG:uji"
  # Gagal --wait tetap lanjut ke health: diagnosis & petunjuk muncul di sana.
  "${DC[@]}" up -d --no-build --remove-orphans --wait ${SKALA[@]+"${SKALA[@]}"} || true
  health
  exit 0
fi

if [[ $PULL -eq 1 ]]; then
  echo "==> git pull"
  git -C "$ROOT" pull --ff-only || die "git pull gagal (checkout detached? pakai --no-pull setelah git checkout <ref>)"
fi
SHA="$(git -C "$ROOT" rev-parse --short=7 HEAD)"
echo "==> Versi: $(git -C "$ROOT" log -1 --format='%h %s')"
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || echo "PERINGATAN: ada perubahan lokal yang ikut ter-build" >&2

# Dari :uji-sehat, bukan :uji — :uji bisa berisi build gagal dari percobaan sebelumnya.
echo "==> Simpan image sehat terakhir sebagai :uji-prev"
docker image inspect "$IMG:uji-sehat" >/dev/null 2>&1 && docker tag "$IMG:uji-sehat" "$IMG:uji-prev" || true

echo "==> Build image $IMG:uji ($SHA)"
# Tanpa --pull: base image dipin digest, jadi --pull hanya menambah request Docker Hub & titik gagal.
"${DC[@]}" build cc-web
docker tag "$IMG:uji" "$IMG:$SHA"

echo "==> Database uji"
"${DC[@]}" up -d --wait postgres
mkdir -p "$DIR/backups" && chmod 700 "$DIR/backups"
DUMP="$DIR/backups/uji-$(date +%F-%H%M%S)-$SHA.dump"
echo "==> Backup: $DUMP"
"${DC[@]}" exec -T postgres pg_dump -U postgres -Fc contact_center_uji > "$DUMP"
chmod 600 "$DUMP"
[[ -s "$DUMP" ]] || die "backup kosong"

# Setelah backup, sebelum container baru: tabel khusus Next.js (cc_*) & skema pg-boss, hanya aditif dan idempoten.
# Worker baru butuh skema pg-boss versi image ini. Gagal → berhenti; container lama tetap berjalan.
echo "==> Migrasi Next.js (cc_migrate: tabel cc_*, skema pgboss)"
"${DC[@]}" run --rm migrate || die "migrasi gagal — stack lama tetap berjalan; pulihkan dari $DUMP bila perlu"

echo "==> Jalankan stack"
"${DC[@]}" up -d --remove-orphans --wait || true
health

echo "==> Bersihkan tag SHA & backup lama (hanya $IMG dan deploy/next/backups)"
docker images --format '{{.Tag}}' "$IMG" | grep -E '^[0-9a-f]{7,40}$' | tail -n +$((SIMPAN_SHA + 1)) \
  | while read -r t; do docker rmi "$IMG:$t" >/dev/null 2>&1 || true; done
ls -1t "$DIR"/backups/uji-*.dump 2>/dev/null | tail -n +11 | xargs -r rm -f

echo "Selesai ($SHA). Rollback bila perlu: bash scripts/deploy-uji.sh --rollback  atau  --rollback=<sha> (lihat --versi)"
