#!/usr/bin/env bash
# Uji binary native stack Contact Center di CPU server (QEMU tanpa AVX/AVX2, rencana §9.10).
# Yang diuji = yang akan dipakai: image dari deploy/next/ (Dockerfile & compose.yml), lalu web/ ASLI +
# sigap/ tersaring (daftar sama dengan deploy/next/Dockerfile.dockerignore) dengan `npm ci` dari lockfile:
#   - npm ci        : paket native prebuilt dari lockfile (web/.npmrc ignore-scripts → tanpa install script)
#   - next build    : @next/swc, Turbopack, @tailwindcss/oxide, lightningcss, esbuild (plugin PostCSS)
#   - server        : node web/server.js dari output standalone, --read-only + tmpfs, GET /up, TZ
#   - sharp, Valkey, PgBouncer
#
# Jalankan DI SERVER hanya setelah persetujuan pemilik proyek, dari clone repo ini:
#   bash scripts/cek-binary-native.sh            # uji penuh
#   bash scripts/cek-binary-native.sh --rencana  # hanya tampilkan flag CPU & image, tanpa docker
#
# Aman: semua berkas di direktori temp (dihapus di akhir), container sekali pakai bernama
# cc-cek-<pid>-* (dihapus di akhir, juga saat Ctrl-C), dibatasi 2 CPU / 4 GB, berjalan sebagai user
# pemanggil. Hanya `npm ci` yang memakai jaringan; semua uji berjalan dengan --network none.
# Efek di luar temp: image yang di-pull tetap ada di cache Docker (hapus manual bila perlu).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RENCANA=0
for a in "$@"; do
  case "$a" in
    --rencana) RENCANA=1 ;;
    *) echo "Opsi tidak dikenal: $a" >&2; exit 2 ;;
  esac
done

die() { echo "GAGAL: $*" >&2; exit 1; }

NODE_IMAGE="$(sed -nE 's/^ARG NODE_IMAGE=(.+)$/\1/p' "$ROOT/deploy/next/Dockerfile")"
VALKEY_IMAGE="$(grep -oE 'valkey/valkey:[^" ]+' "$ROOT/deploy/next/compose.yml" | head -n1)"
PGB_IMAGE="$(grep -oE 'edoburu/pgbouncer:[^" ]+' "$ROOT/deploy/next/compose.yml" | head -n1)"
[[ -n "$NODE_IMAGE" && -n "$VALKEY_IMAGE" && -n "$PGB_IMAGE" ]] || die "image tidak terbaca dari deploy/next/"
# Pola web/ & sigap/ dari dockerignore → --exclude tar (satu sumber kebenaran dengan konteks image).
EXCL=()
while IFS= read -r l; do EXCL+=("--exclude=$l"); done < <(grep -E '^(web|sigap)/' "$ROOT/deploy/next/Dockerfile.dockerignore")

declare -a HASIL=()
catat() { HASIL+=("$1|$2|$3"); }
tabel() {
  printf '\n%-34s %-5s %s\n' "UJI" "HASIL" "KETERANGAN"
  printf '%-34s %-5s %s\n' "---" "-----" "----------"
  local r gagal=0
  for r in "${HASIL[@]}"; do
    IFS='|' read -r n s d <<<"$r"
    printf '%-34s %-5s %s\n' "$n" "$s" "$d"
    [[ "$s" == FAIL ]] && gagal=1
  done
  return $gagal
}

# ---- Flag CPU ----
# x86-64-v2 (wajib untuk prebuilt sharp/libvips & SWC): cx16 lahf_lm popcnt sse4_1 sse4_2 ssse3.
if [[ -r /proc/cpuinfo ]]; then
  FLAGS=" $(grep -m1 '^flags' /proc/cpuinfo | cut -d: -f2) "
  kurang=""
  for f in cx16 lahf_lm popcnt sse4_1 sse4_2 ssse3; do [[ "$FLAGS" == *" $f "* ]] || kurang+=" $f"; done
  if [[ -z "$kurang" ]]; then catat "CPU x86-64-v2" OK "$(uname -m), $(nproc) CPU"
  else catat "CPU x86-64-v2" FAIL "tidak ada:$kurang"; fi
  ada=""
  for f in avx avx2 fma bmi2 avx512f; do [[ "$FLAGS" == *" $f "* ]] && ada+=" $f"; done
  catat "CPU AVX (info)" INFO "${ada:- tidak ada avx/avx2/fma/bmi2/avx512f}"
else
  catat "CPU flags" FAIL "/proc/cpuinfo tidak terbaca (bukan Linux?)"
fi


echo "Image node    : $NODE_IMAGE"
echo "Image valkey  : $VALKEY_IMAGE"
echo "Image pgbounce: $PGB_IMAGE"
echo "Exclude       : ${EXCL[*]}"
if [[ $RENCANA -eq 1 ]]; then tabel || true; exit 0; fi

[[ -f "$ROOT/web/package-lock.json" && -d "$ROOT/sigap" ]] || die "web/package-lock.json atau sigap/ tidak ada di $ROOT"
command -v docker >/dev/null 2>&1 || die "docker tidak ditemukan — skrip ini hanya untuk server dengan Docker"
docker info >/dev/null 2>&1 || die "tidak bisa menghubungi daemon Docker"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/cc-cek-binary.XXXXXX")"
PREFIX="cc-cek-$$"
bersih() {
  local ids
  ids="$(docker ps -aq --filter "name=^${PREFIX}-" 2>/dev/null || true)"
  # shellcheck disable=SC2086 # satu argumen per id
  [[ -n "$ids" ]] && docker rm -f $ids >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap bersih EXIT
trap 'exit 130' INT TERM

# Semua container: sekali pakai, dibatasi. Yang me-mount $TMP berjalan sebagai user pemanggil
# supaya berkas buatannya bisa dihapus tanpa root.
jalan() { local nama="$1"; shift; docker run --rm --name "$PREFIX-$nama" --cpus 2 --memory 4g "$@"; }
UID_GID="$(id -u):$(id -g)"
NODE_RUN=(--user "$UID_GID" -e HOME=/tmp -e NEXT_TELEMETRY_DISABLED=1 -v "$TMP/repo:/repo" -w /repo/web "$NODE_IMAGE")
sigill() { [[ $1 -eq 132 ]] && echo " (SIGILL: instruksi CPU tidak didukung)"; true; }

echo "==> Pull image (pakai jaringan)"
for img in "$NODE_IMAGE" "$VALKEY_IMAGE" "$PGB_IMAGE"; do docker pull -q "$img" >/dev/null || die "pull gagal: $img"; done

echo "==> Salin web/ + sigap/ tersaring ke $TMP/repo"
mkdir -p "$TMP/repo"
tar -C "$ROOT" "${EXCL[@]}" -cf - web sigap | tar -C "$TMP/repo" -xf -

echo "==> npm ci di web/ (pakai jaringan)"
kode=0
jalan npmci -e npm_config_cache=/repo/.npm "${NODE_RUN[@]}" npm ci --no-audit --no-fund --loglevel=error >"$TMP/npm.log" 2>&1 || kode=$?
if [[ $kode -eq 0 ]]; then
  nm="$TMP/repo/web/node_modules"
  native="$(cd "$nm" && ls -d @next/swc-* @tailwindcss/oxide-* lightningcss-* @esbuild/* @img/sharp-* 2>/dev/null | tr '\n' ' ' || true)"
  catat "npm ci (lockfile web/)" OK "${native:-tidak ada paket native terdeteksi}"
else
  catat "npm ci (lockfile web/)" FAIL "exit $kode$(sigill $kode)"; tail -n 20 "$TMP/npm.log"
fi

# next langsung lewat node (bukan npx/npm) supaya exit 132 = SIGILL terlihat apa adanya.
uji_build() {
  local label="$1"; shift
  local log="$TMP/build-$label.log" kode=0
  rm -rf "$TMP/repo/web/.next"
  jalan "build-$label" --network none "${NODE_RUN[@]}" node node_modules/next/dist/bin/next build "$@" >"$log" 2>&1 || kode=$?
  if [[ $kode -ne 0 ]]; then
    catat "next build $label" FAIL "exit $kode$(sigill $kode)"
    tail -n 20 "$log"
  elif grep -qiE 'swc-wasm|failed to load swc|wasm fallback' "$log"; then
    catat "next build $label" WARN "lulus tapi jatuh ke SWC WASM (lambat)"
  else
    catat "next build $label" OK "binary native"
  fi
  return $kode
}
# Webpack hanya dicoba bila Turbopack gagal, sebagai info jalan keluar.
uji_build turbopack || uji_build webpack --webpack || true

# Server standalone seperti image: read-only, hanya /tmp & web/.next/cache yang bisa ditulis.
S="$TMP/repo/web/.next/standalone"
if [[ -f "$S/web/server.js" ]]; then
  cp -R "$TMP/repo/web/.next/static" "$S/web/.next/static"
  [[ -d "$TMP/repo/web/public" ]] && cp -R "$TMP/repo/web/public" "$S/web/public"
  mkdir -p "$S/web/.next/cache"
  # Env dummy hanya agar validasi env produksi lolos; tidak ada koneksi DB saat start.
  jalan server -d --network none --read-only --tmpfs /tmp --tmpfs /app/web/.next/cache:mode=1777 \
    --user "$UID_GID" -e NODE_ENV=production -e TZ=Asia/Jakarta -e PORT=3000 -e HOSTNAME=127.0.0.1 \
    -e APP_URL=http://127.0.0.1:3000 -e DATABASE_URL=postgres://cek:cek@127.0.0.1:1/cek \
    -v "$S:/app:ro" -w /app "$NODE_IMAGE" node web/server.js >/dev/null
  UP_JS='fetch("http://127.0.0.1:3000/up").then(r=>r.text().then(t=>{console.log(r.status,t);process.exit(r.ok?0:1)}),()=>process.exit(1))'
  hasil=""
  for _ in $(seq 1 30); do
    hasil="$(docker exec "$PREFIX-server" node -e "$UP_JS" 2>/dev/null)" && break
    hasil=""; sleep 1
  done
  if [[ -n "$hasil" ]]; then catat "node web/server.js read-only /up" OK "$hasil"
  else catat "node web/server.js read-only /up" FAIL "tidak sehat dalam 30 dtk"; docker logs --tail 20 "$PREFIX-server" 2>&1 || true; fi
  if docker exec "$PREFIX-server" node -e 'process.exit(new Date(0).getTimezoneOffset()===-420?0:1)' 2>/dev/null; then
    catat "TZ Asia/Jakarta (ICU Node)" OK "UTC+7"
  else
    catat "TZ Asia/Jakarta (ICU Node)" FAIL "offset bukan UTC+7"
  fi
  docker rm -f "$PREFIX-server" >/dev/null 2>&1 || true
else
  catat "node web/server.js read-only /up" FAIL "tidak ada .next/standalone/web/server.js (build gagal?)"
fi

# sharp dari node_modules web/ (dependensi opsional next): muat, buat PNG 8x8, resize ke JPEG 4x4.
SHARP_JS='let s;try{s=require("sharp")}catch(e){console.log("TIDAK-TERPASANG");process.exit(3)}
s({create:{width:8,height:8,channels:3,background:"#c00"}}).png().toBuffer()
.then(b=>s(b).resize(4,4).jpeg().toBuffer()).then(b=>console.log("libvips",s.versions.vips,"jpeg",b.length,"B"))
.catch(e=>{console.error(e);process.exit(1)})'
kode=0
out="$(jalan sharp --network none "${NODE_RUN[@]}" node -e "$SHARP_JS" 2>&1)" || kode=$?
case $kode in
  0) catat "sharp load + resize" OK "$(tail -n1 <<<"$out")" ;;
  3) catat "sharp load + resize" INFO "sharp tidak terpasang di web/" ;;
  *) catat "sharp load + resize" FAIL "exit $kode$(sigill $kode) $(tail -n1 <<<"$out")" ;;
esac

# Valkey: start, perintah dasar + yang punya jalur SIMD (BITCOUNT, HyperLogLog).
VALKEY_SH='valkey-server --daemonize yes --save "" --appendonly no --dir /tmp --pidfile /tmp/v.pid && sleep 1 &&
valkey-cli ping && valkey-cli set cc:cek ok >/dev/null && valkey-cli get cc:cek &&
valkey-cli setbit cc:b 7 1 >/dev/null && valkey-cli bitcount cc:b &&
valkey-cli pfadd cc:h a b c >/dev/null && valkey-cli pfcount cc:h && valkey-server --version'
if out="$(jalan valkey --network none --entrypoint sh "$VALKEY_IMAGE" -c "$VALKEY_SH" 2>&1)"; then
  catat "valkey start + ping/bitcount/pfcount" OK "$(tail -n1 <<<"$out" | cut -c1-60)"
else
  catat "valkey start + ping/bitcount/pfcount" FAIL "$(tail -n1 <<<"$out")"
fi

# PgBouncer: start dengan konfigurasi minimal, lalu query konsol admin (tanpa PostgreSQL).
PGB_SH='printf "[databases]\n* = host=127.0.0.1 port=5432\n[pgbouncer]\nlisten_addr = 127.0.0.1\nlisten_port = 6432\nunix_socket_dir =\nauth_type = trust\nauth_file = /tmp/u.txt\nadmin_users = cek\npool_mode = transaction\n" > /tmp/p.ini &&
printf "\"cek\" \"\"\n" > /tmp/u.txt && (pgbouncer -q /tmp/p.ini &) && sleep 1 &&
psql -h 127.0.0.1 -p 6432 -U cek -d pgbouncer -tAc "SHOW VERSION"'
if out="$(jalan pgbouncer --network none --entrypoint sh "$PGB_IMAGE" -c "$PGB_SH" 2>&1)"; then
  catat "pgbouncer start + SHOW VERSION" OK "$(tail -n1 <<<"$out")"
else
  catat "pgbouncer start + SHOW VERSION" FAIL "$(tail -n1 <<<"$out")"
fi

# TODO(realtime): uji Soketi (rencana §9.10) saat image-nya masuk deploy/next/compose.yml.
catat "soketi" TODO "belum ada di deploy/next; tambahkan saat realtime masuk"

tabel && echo -e "\nSemua lulus." || { echo -e "\nAda yang FAIL — lihat rencana §9.10 (build di CI / varian baseline)." >&2; exit 1; }
