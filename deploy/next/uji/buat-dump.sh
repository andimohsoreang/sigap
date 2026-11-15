#!/usr/bin/env bash
# Membuat ulang schema.sql + seed.sql (DB subdomain uji) dari DB dev lokal, TANPA PHP di server.
# Jalankan di laptop (PostgreSQL 16 Homebrew, docs/slices/S0.md "DB dev"), dari mana saja:
#   bash deploy/next/uji/buat-dump.sh
# Prasyarat: contact_center_dev = migrasi tag `laravel-baseline` + seeder (cek di bawah), auth trust lokal.
# Lalu commit kedua berkas. Volume pgdata-uji yang SUDAH terisi tidak berubah — init postgres hanya
# jalan pada volume kosong (lihat init.sh).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-cc_migrate}" PGDATABASE="${PGDATABASE:-contact_center_dev}"
die() { echo "GAGAL: $*" >&2; exit 1; }

# Versi server = versi pg_dump = postgres:16-alpine di compose (16.x); format dump plain SQL.
[[ "$(pg_dump --version)" =~ \ 16\. ]] || die "butuh pg_dump 16 (sekarang: $(pg_dump --version))"

# Skema harus persis migrasi laravel-baseline (beku), bukan hasil migrasi lain.
diff <(git -C "$ROOT" ls-tree --name-only laravel-baseline sigap/database/migrations/ | xargs -n1 basename | sed 's/\.php$//' | sort) \
     <(psql -tAc 'SELECT migration FROM migrations' | sort) >/dev/null \
  || die "tabel migrations $PGDATABASE berbeda dari tag laravel-baseline"

# Hanya data seeder (master data) yang boleh ikut; tabel lain (akun, tiket, chat, sesi, log) wajib kosong
# supaya tidak ada data pribadi di repo.
SEED="'categories','channels','knowledge_articles','knowledge_sources','migrations','portals','regions','settings','units'"
cek="$(psql -tAc "SELECT string_agg(format('SELECT %L WHERE EXISTS (SELECT 1 FROM public.%I)', tablename, tablename), ' UNION ALL ')
  FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ($SEED)")"
isi="$(psql -tAc "$cek" | tr '\n' ' ')"
[[ -z "${isi// /}" ]] || die "tabel non-seed berisi data: $isi— kosongkan dulu (data pribadi tidak boleh masuk repo)"

# --restrict-key tetap: dump berasal dari DB sendiri, dan kunci acak membuat diff berisik tiap regenerasi.
UMUM=(--no-owner --no-privileges --restrict-key=ccuji)
pg_dump "${UMUM[@]}" --schema-only > "$DIR/schema.sql"
pg_dump "${UMUM[@]}" --data-only > "$DIR/seed.sql"
echo "OK: $(grep -c '^CREATE TABLE' "$DIR/schema.sql") tabel, $(grep -c '^COPY ' "$DIR/seed.sql") COPY → $DIR/{schema,seed}.sql"
