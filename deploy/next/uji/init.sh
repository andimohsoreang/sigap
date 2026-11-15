#!/usr/bin/env bash
# Init DB subdomain uji. Dijalankan entrypoint image postgres SEKALI, hanya saat volume pgdata-uji kosong
# (database $POSTGRES_DB sudah dibuat entrypoint, milik superuser). Isinya:
#   1. role & hak akses sama dengan DB dev lokal (docs/slices/S0.md, rencana §9.3):
#      cc_migrate = pemilik DB, skema public & semua objek (DDL); cc_app = DML; cc_readonly = SELECT;
#      ditambah statement_timeout/idle_in_transaction_session_timeout per role.
#   2. skema + data seeder baseline Laravel (schema.sql, seed.sql — dibuat deploy/next/uji/buat-dump.sh)
#      dimuat SEBAGAI cc_migrate dalam satu transaksi, sehingga default privileges di bawah berlaku.
# Sandi role datang dari env service postgres (compose.yml), diteruskan sebagai variabel psql (:'x' →
# literal ber-quote), tidak pernah disisipkan ke teks SQL oleh shell.
# Mengisi ulang dari nol (DB uji boleh direset): hentikan stack, hapus volume pgdata-uji, deploy lagi.
set -euo pipefail

UJI="${UJI_DIR:-/uji}"
: "${CC_MIGRATE_PASSWORD:?}" "${CC_APP_PASSWORD:?}" "${CC_READONLY_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v db="$POSTGRES_DB" -v pw_migrate="$CC_MIGRATE_PASSWORD" -v pw_app="$CC_APP_PASSWORD" -v pw_ro="$CC_READONLY_PASSWORD" <<'SQL'
CREATE ROLE cc_migrate LOGIN PASSWORD :'pw_migrate';
CREATE ROLE cc_app LOGIN PASSWORD :'pw_app';
CREATE ROLE cc_readonly LOGIN PASSWORD :'pw_ro';
ALTER DATABASE :"db" OWNER TO cc_migrate;
ALTER SCHEMA public OWNER TO cc_migrate;
GRANT USAGE ON SCHEMA public TO cc_app, cc_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE cc_migrate IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cc_app;
ALTER DEFAULT PRIVILEGES FOR ROLE cc_migrate IN SCHEMA public GRANT SELECT ON TABLES TO cc_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE cc_migrate IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cc_app;
-- Batas waktu per role (rencana §9.3): PgBouncer menolak parameter startup ini dari klien, jadi dipasang di
-- role. cc_migrate tanpa batas (migrasi panjang).
ALTER ROLE cc_app SET statement_timeout = '15s';
ALTER ROLE cc_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE cc_readonly SET statement_timeout = '60s';
SQL

# role=cc_migrate saat koneksi: objek dibuat milik cc_migrate (dump memakai --no-owner).
PGOPTIONS='-c role=cc_migrate' psql -v ON_ERROR_STOP=1 --single-transaction -q -o /dev/null -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -f "$UJI/schema.sql" -f "$UJI/seed.sql"
