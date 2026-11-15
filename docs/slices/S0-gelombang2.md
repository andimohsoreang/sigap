# S0 Gelombang 2 — Runtime & subdomain uji (tanpa jembatan)

| Field | Isi |
|---|---|
| Diperbarui | 15 Nov 2026 — strategi per fitur **tanpa jembatan** (`docs/RENCANA-PER-FITUR.md` §0) |
| Mulai | setelah paket B digabung ke `rewrite/s0` |
| Acuan | `docs/RENCANA-REWRITE-NEXTJS.md` §9, catatan gelombang 2 di `docs/slices/S0.md` |
| Siklus | tiap paket: bangun → QA → review (+ optimasi ditanyakan ke pemilik proyek) → gabung (§6.6) |
| Langkah server | hanya dengan persetujuan pemilik proyek, satu persetujuan per langkah |

Laravel tetap berjalan di app2 sebagai kunci jawaban; Next.js **tidak** berbagi sesi, rute, cron, atau Reverb
dengan Laravel. Satu-satunya yang dibagi saat pengujian: skema PostgreSQL dan data uji (paritas).

## Paket

| Paket | Isi | Peran | Bergantung | Estimasi kerja agent |
|---|---|---|---|---|
| **B (penyesuaian)** | Hapus modul yang hanya untuk jembatan sesi Laravel (`cookie.ts`, `sesi.ts`, `recaller.ts`, `php-serial.ts` + fixture/test terkait). Pertahankan `laravel-crypt.ts` (NIK/kontak terenkripsi pada data uji bersama), `nik.ts`, `sandi.ts` (bcrypt `$2y$` + worker pool) | programmer #2 | — | 15–20 mnt |
| **E. Lapisan DB** | `drizzle-kit pull` dari `contact_center_dev` → `src/server/db/schema.ts`; relasi seperlunya; tipe kolom `waktuWib` (data uji ditulis Laravel dalam jam WIB); tipe kolom terenkripsi (pakai `legacy/laravel-crypt`); helper transaksi + `FOR UPDATE`; pool `pg` aman untuk PgBouncer mode transaksi | programmer #1 | B | 60–90 mnt |
| **F. Auth & permintaan** | Sesi **milik Next.js** (`cc_session`, tabel sesi sendiri, lifetime 120 menit seperti Laravel, rotasi id saat login, invalidasi saat ganti sandi); login NIK/username + bcrypt + timebox + rate limit; logout; guard peran & policy `TicketPolicy`/`UserPolicy` (fungsi murni + test); CSRF (cek Origin/Server Actions); flash; `middleware.ts` dengan CSP ber-nonce identik `SecurityHeaders` + header keamanan | programmer #2 | B, E, G (rate limit) | 90–120 mnt |
| **G. Runtime bersama** | Valkey (prefix `cc:`) + 9 rate limiter angka Laravel + fallback per-instance; pg-boss + proses `worker` + runner cron; tabel outbox + dispatcher; idempotency key 24 jam; realtime via **Sockudo** (penerbit server + konfigurasi klien `pusher-js`, channel & event sama dengan Laravel) | programmer #1 (setelah E) | E | 90–120 mnt |
| **H. Subdomain uji** | Stack Next.js terpisah di server (project Compose sendiri: web, worker, valkey, pgbouncer, sockudo, postgres uji `contact_center_uji` berisi skema + seed baseline); hostname Cloudflare Tunnel untuk subdomain uji; skrip deploy (tag SHA, backup, rollback); rencana pergantian akhir app2 | devops | E–G | 60–90 mnt + **persetujuan** |
| **I. Observabilitas minimum** | OpenTelemetry di web & worker, log JSON, pelacakan error (GlitchTip) — stack lengkap Grafana/Loki menyusul sebelum pergantian akhir | devops | E, G | 45–60 mnt + **persetujuan** |
| **J. Sandbox & audit** | Sandbox Docker untuk skill `security-audit` (`--network none`, read-only, batas); audit `standard` scoped atas kode S0 (B, E, F, G) | devops + orkestrator | B–G | 60–90 mnt |

Urutan: **B′ → E → G → F → (H ∥ I) → J**.

## Gerbang S0 (selesai bila)

Di **subdomain uji**:
1. `/_platform` tampil 0 piksel beda dengan layout Laravel;
2. login & logout warga dan admin lewat Next.js berjalan (sesi `cc_session`), akses salah peran ditolak seperti Laravel;
3. event realtime (Sockudo) terkirim dari server dan diterima halaman;
4. rate limit login bekerja (angka Laravel) dan tetap aman saat Valkey dimatikan;
5. CI `web` & `paritas` hijau; audit keamanan tanpa temuan `confirmed` ≥ medium.

## Subdomain uji (siap, 15 Nov 2026)

| Hal | Nilai |
|---|---|
| Hostname | `cc-uji.andimohamad.my.id` (CNAME ke tunnel `babd7433-…`, dibuat lewat `cloudflared tunnel route dns`) |
| Ingress | `/etc/cloudflared/config.yml` rule #12 → `http://localhost:8094` (port 8093 sudah dipakai `simtl`) |
| Akses | Cloudflare Access app **Contact Center Uji**, policy `OnlyMe` (hanya email akun Cloudflare pemilik), sesi 24 jam; tanpa login → 302 ke `broad-brook-65c1.cloudflareaccess.com` |
| Catatan | config cloudflared ditandai "di-manage oleh Hermes" — rule bisa tertimpa bila Hermes menulis ulang; perubahan config berikutnya lewat skrip: backup → ubah → `ingress validate` → baru restart |
| Untuk CI/QA nanti | Service Token Access (Zero Trust → Service credentials) agar smoke test otomatis bisa masuk |

### Syarat paket H (stack uji, `deploy/next/`)

| Syarat | Nilai | Di mana |
|---|---|---|
| Antrean PgBouncer | `query_wait_timeout = 10` dtk (bawaan 120 dtk > `stop_grace_period` cc-web 30 dtk) | `pgbouncer/pgbouncer.ini` |
| Timeout per role (PgBouncer menolak parameter ini dari klien) | `cc_app`: `statement_timeout` 15s, `idle_in_transaction_session_timeout` 30s; `cc_readonly`: `statement_timeout` 30s; `cc_migrate`: tanpa batas | `uji/init.sh` (berlaku saat volume `pgdata-uji` dibuat; volume lama: `ALTER ROLE` manual) |
| Realtime | Sockudo 5.2.0 (dipin digest), satu instance adapter `local`, browser lewat `/_realtime/app/:key` di cc-web | `compose.yml` |

## Butuh dari pemilik proyek

| Langkah | Kapan |
|---|---|
| Nama subdomain uji + hostname di Cloudflare Tunnel | paket H |
| Menjalankan stack subdomain uji di server | paket H |
| GlitchTip/OTel collector di server | paket I |
