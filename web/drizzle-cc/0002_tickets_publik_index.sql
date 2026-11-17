-- Ditulis tangan (drizzle-kit generate --custom): indeks milik Next.js di tabel Laravel `tickets`, disetujui pemilik
-- proyek 18 Nov 2026. Skema Laravel tetap acuan tabel bersama; indeks ini hanya tambahan (aditif) yang tidak mengubah
-- hasil query mana pun, dan dibuat di sini karena dibutuhkan statistik /tentang (src/server/statistik/repo.ts):
-- subquery withCount per kategori/kanal (WHERE category_id|channel_id = … AND is_internal = false AND deleted_at IS NULL)
-- menjadi index-only scan, alih-alih membaca heap tiket berulang kali. Laravel juga dapat memakainya: tiap query
-- di-prepare & dijalankan sekali dengan nilai `false`, jadi PostgreSQL memakai rencana custom.
-- Nama mengikuti konvensi Laravel `<tabel>_<kolom>_index`, tanpa bentrok dengan tickets_category_id_index.
-- Migrator drizzle berjalan dalam transaksi → tanpa CONCURRENTLY (mengunci tulis `tickets` selama pembuatan). DB besar:
-- buat dulu secara manual dengan CREATE INDEX CONCURRENTLY nama & definisi yang sama; IF NOT EXISTS lalu melewatinya
-- (docs/slices/S1.md, "Catatan pergantian").
-- lock_timeout: CREATE INDEX menunggu kunci SHARE di `tickets`; bila ada transaksi tulis panjang, gagal setelah 5 dtk
-- (migrasi diulang) alih-alih membuat antrean INSERT tiket di belakangnya. SET LOCAL berlaku sampai akhir transaksi
-- migrasi, termasuk migrasi berikutnya yang ikut tertunda dalam batch yang sama.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_category_id_publik_index" ON "tickets" USING btree ("category_id") WHERE "is_internal" = false AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_channel_id_publik_index" ON "tickets" USING btree ("channel_id") WHERE "is_internal" = false AND "deleted_at" IS NULL;
