#!/usr/bin/env bash
# Uji binary native stack Contact Center di CPU server (QEMU tanpa AVX/AVX2, rencana §9.10):
# `next build` (SWC/Turbopack), sharp, Valkey, PgBouncer. Image diambil dari deploy/next/
# (Dockerfile & compose.yml), jadi yang diuji = yang akan dipakai.
#
# Jalankan DI SERVER hanya setelah persetujuan pemilik proyek, dari clone repo ini:
#   bash scripts/cek-binary-native.sh            # uji penuh
#   bash scripts/cek-binary-native.sh --rencana  # hanya tampilkan flag CPU & image, tanpa docker
#
# Aman: semua berkas di direktori temp (dihapus di akhir), container sekali pakai bernama
# cc-cek-<pid>-* (dihapus di akhir, juga saat Ctrl-C), dibatasi 2 CPU / 3 GB. Hanya langkah
# `npm install` yang memakai jaringan; semua uji berjalan dengan --network none.
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
# Versi persis dari web/package.json (kontrak S0: dikunci persis); default bila web/ belum ada.
ver() { [[ -f "$ROOT/web/package.json" ]] && sed -nE "s/^ *\"$1\": *\"([^\"]+)\".*/\1/p" "$ROOT/web/package.json" | head -n1; }
NEXT_V="$(ver next || true)"; NEXT_V="${NEXT_V:-16.4.6}"
REACT_V="$(ver react || true)"; REACT_V="${REACT_V:-19}"
SHARP_V="$(ver sharp || true)"

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
echo "next@$NEXT_V react@$REACT_V sharp@${SHARP_V:-<ikut next>}"
if [[ $RENCANA -eq 1 ]]; then tabel || true; exit 0; fi

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

# Semua container: sekali pakai, non-root (berkas di $TMP tetap milik pemanggil), dibatasi.
jalan() { local nama="$1"; shift; docker run --rm --name "$PREFIX-$nama" --cpus 2 --memory 3g "$@"; }
UID_GID="$(id -u):$(id -g)"

echo "==> Pull image (pakai jaringan)"
for img in "$NODE_IMAGE" "$VALKEY_IMAGE" "$PGB_IMAGE"; do docker pull -q "$img" >/dev/null || die "pull gagal: $img"; done

# ---- Proyek Next.js minimal (menguji CPU, bukan kode aplikasi) ----
mkdir -p "$TMP/app/app"
cat >"$TMP/app/package.json" <<'JSON'
{ "private": true, "scripts": { "build": "next build" } }
JSON
# JSX biasa (bukan TS) supaya build tidak butuh paket typescript/@types.
cat >"$TMP/app/app/layout.jsx" <<'JSX'
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
JSX
cat >"$TMP/app/app/page.jsx" <<'JSX'
export default function Page() { return <main>cek</main>; }
JSX

echo "==> npm install next@$NEXT_V (pakai jaringan)"
pkgs=("next@$NEXT_V" "react@$REACT_V" "react-dom@$REACT_V")
[[ -n "$SHARP_V" ]] && pkgs+=("sharp@$SHARP_V")
if jalan npm --user "$UID_GID" -e HOME=/tmp -e npm_config_cache=/w/.npm -v "$TMP/app:/w" -w /w "$NODE_IMAGE" \
     npm install --no-audit --no-fund --loglevel=error "${pkgs[@]}" >"$TMP/npm.log" 2>&1; then
  swc="$(ls "$TMP/app/node_modules/@next" 2>/dev/null | grep '^swc-' | tr '\n' ' ' || true)"
  catat "npm install" OK "binary: ${swc:-tidak ada @next/swc-*}"
else
  catat "npm install" FAIL "lihat log di bawah"; tail -n 20 "$TMP/npm.log"
fi

# Uji tanpa jaringan. Exit 132 = SIGILL (instruksi CPU tidak didukung).
uji_build() {
  local label="$1"; shift
  local log="$TMP/build-$label.log" kode=0
  rm -rf "$TMP/app/.next"
  jalan "build-$label" --network none --user "$UID_GID" -e HOME=/tmp -e NEXT_TELEMETRY_DISABLED=1 \
    -v "$TMP/app:/w" -w /w "$NODE_IMAGE" npx --no-install next build "$@" >"$log" 2>&1 || kode=$?
  if [[ $kode -ne 0 ]]; then
    catat "next build $label" FAIL "exit $kode$([[ $kode -eq 132 ]] && echo ' (SIGILL: instruksi CPU)')"
    tail -n 20 "$log"
  elif grep -qiE 'swc-wasm|failed to load swc|wasm fallback' "$log"; then
    catat "next build $label" WARN "lulus tapi jatuh ke SWC WASM (lambat)"
  else
    catat "next build $label" OK "binary native"
  fi
}
uji_build turbopack
uji_build webpack --webpack

# sharp: muat modul, buat PNG 8x8, resize ke JPEG 4x4.
SHARP_JS='const s=require("sharp");s({create:{width:8,height:8,channels:3,background:"#c00"}}).png().toBuffer()
.then(b=>s(b).resize(4,4).jpeg().toBuffer()).then(b=>console.log("libvips",s.versions.vips,"jpeg",b.length,"B"))
.catch(e=>{console.error(e);process.exit(1)})'
if out="$(jalan sharp --network none --user "$UID_GID" -e HOME=/tmp -v "$TMP/app:/w" -w /w "$NODE_IMAGE" \
          node -e "$SHARP_JS" 2>&1)"; then
  catat "sharp load + resize" OK "$(tail -n1 <<<"$out")"
else
  catat "sharp load + resize" FAIL "$(tail -n1 <<<"$out")"
fi

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

tabel && echo -e "\nSemua lulus." || { echo -e "\nAda yang FAIL — lihat rencana §9.10 (build di CI / varian baseline)." >&2; exit 1; }
