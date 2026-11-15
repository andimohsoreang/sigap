#!/usr/bin/env bash
# Buat akun super_admin di DB subdomain uji — padanan `php artisan sigap:admin` (CreateAdminCommand) tanpa PHP.
# Jalankan DI SERVER dari clone /opt/cc-uji, setelah stack uji sehat (scripts/deploy-uji.sh):
#   bash deploy/next/uji/buat-admin.sh <username> ["Nama lengkap"]
# - Kolom & nilai seperti User::create di sigap:admin: username, name, role=super_admin, password, is_active=true,
#   created_at/updated_at jam WIB tanpa zona (cara Laravel menulis timestamp di DB ini).
# - Sandi acak 24 karakter (memenuhi aturan admin Laravel: ≥ 12, huruf besar, huruf kecil, angka), di-hash bcrypt
#   `$2y$` cost 12 (= BCRYPT_ROUNDS Laravel) oleh Node + bcryptjs di image cc-web, lewat stdin.
# - Sandi dicetak SEKALI ke /dev/tty (bukan stdout: tidak ikut redirect/log), tidak ditulis ke berkas.
# - INSERT sebagai cc_app lewat PgBouncer; sandi cc_app dibaca dari userlist di dalam container pgbouncer.
# Uji lokal (klaster PostgreSQL sementara, tanpa Docker): UJI_LOKAL=1 + PGHOST/PGPORT/PGUSER/PGDATABASE, Node dengan
# bcryptjs dapat di-resolve dari direktori kerja; sandi lalu dicetak ke stdout.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DIR="$ROOT/deploy/next"
die() { echo "GAGAL: $*" >&2; exit 1; }

U="${1:-}"; NAMA="${2:-Administrator Contact Center}"
[[ $# -le 2 ]] || die "pemakaian: buat-admin.sh <username> [\"Nama lengkap\"]"
# alpha_dash + min:3 seperti validasi sigap:admin; kolom username varchar(50).
[[ "$U" =~ ^[A-Za-z0-9_-]{3,50}$ ]] || die "username 3–50 karakter huruf/angka/_/-"
[[ -n "$NAMA" && ${#NAMA} -le 150 && "$NAMA" != *\\* && ! "$NAMA" =~ [[:cntrl:]] ]] || die "nama 1–150 karakter, tanpa \\ atau karakter kontrol"

HASH_JS='let b;for(const d of [process.cwd(),"/app/web","/app"]){try{b=require(require.resolve("bcryptjs",{paths:[d]}));break}catch{}}
if(!b){console.error("bcryptjs tidak ditemukan di image");process.exit(3)}
let s="";process.stdin.setEncoding("utf8").on("data",d=>s+=d).on("end",()=>process.stdout.write(b.hashSync(s,12).replace(/^\$2[ab]\$/,"$2y$")))'

if [[ "${UJI_LOKAL:-0}" == 1 ]]; then
  HASH=(node -e "$HASH_JS")
  PSQL=(psql -X -q -v ON_ERROR_STOP=1)
  KELUAR=/dev/stdout
else
  [[ -f "$DIR/.env" ]] || die "deploy/next/.env tidak ada — jalankan dari clone stack uji"
  unset COMPOSE_PROJECT_NAME COMPOSE_FILE COMPOSE_PROFILES
  DC=(docker compose -p contact-center-uji -f "$DIR/compose.yml" --env-file "$DIR/.env")
  PSQL_APP='PGPASSWORD="$(sed -n "s/^\"cc_app\" \"\(.*\)\"$/\1/p" /etc/pgbouncer/userlist.txt)" exec psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 6432 -U cc_app -d contact_center "$@"'
  HASH=("${DC[@]}" run --rm --no-deps -T cc-web node -e "$HASH_JS")
  PSQL=("${DC[@]}" exec -T pgbouncer sh -c "$PSQL_APP" sh)
  KELUAR=/dev/tty
  { : > /dev/tty; } 2>/dev/null || die "butuh terminal interaktif (sandi hanya ditampilkan ke terminal)"
fi

SANDI=""
until [[ ${#SANDI} -eq 24 && "$SANDI" =~ [A-Z] && "$SANDI" =~ [a-z] && "$SANDI" =~ [0-9] ]]; do
  SANDI="$(head -c 256 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-24)"
done

HASH_SANDI="$(printf '%s' "$SANDI" | "${HASH[@]}")" || die "hash bcrypt gagal"
[[ "$HASH_SANDI" =~ ^\$2y\$12\$[./A-Za-z0-9]{53}$ ]] || die "hash bukan format \$2y\$12\$ Laravel"

# Nilai lewat stdin psql sebagai literal SQL (tidak muncul di argumen proses). Username & hash hanya [A-Za-z0-9_./$-];
# nama: kutip tunggal digandakan, backslash sudah ditolak (standard_conforming_strings = on, bawaan PostgreSQL).
SQ="'"
q() { printf "'%s'" "${1//$SQ/$SQ$SQ}"; }
{
  echo "INSERT INTO users (username, name, role, password, is_active, created_at, updated_at)"
  echo "VALUES ($(q "$U"), $(q "$NAMA"), 'super_admin', $(q "$HASH_SANDI"), true,"
  echo "  now() AT TIME ZONE 'Asia/Jakarta', now() AT TIME ZONE 'Asia/Jakarta');"
} | "${PSQL[@]}" || die "INSERT gagal (username sudah dipakai? DB belum siap?)"

printf 'Admin dibuat: %s (super_admin)\nSandi (dicatat SEKALI, tidak disimpan di mana pun): %s\n' "$U" "$SANDI" > "$KELUAR"
