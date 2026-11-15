# S0 Gelombang 2 — Jembatan & runtime

| Field | Isi |
|---|---|
| Mulai | setelah paket B digabung ke `rewrite/s0` |
| Acuan | `docs/RENCANA-PER-FITUR.md` §4 S0 (0.5–0.14), `docs/RENCANA-REWRITE-NEXTJS.md` §9, catatan gelombang 2 di `docs/slices/S0.md` |
| Siklus | tiap paket: bangun → QA → review (+ optimasi ditanyakan ke pemilik proyek) → gabung (§6.6) |
| Langkah server | hanya dengan persetujuan pemilik proyek, satu persetujuan per langkah |

## Paket

| Paket | Isi | Peran | Bergantung | File milik paket | Estimasi kerja agent |
|---|---|---|---|---|---|
| **E. Lapisan DB** | `drizzle-kit pull` dari `contact_center_dev` → `src/server/db/schema.ts`; relasi seperlunya; tipe kolom `waktuWib` (baca `+07:00`, tulis jam WIB dipotong ke detik, format JSON 6 digit mikrodetik seperti Laravel); tipe kolom terenkripsi memakai `legacy/laravel-crypt` (4 kolom + `meta.aktivasi.token`); helper transaksi + `FOR UPDATE`; pool `pg` aman untuk PgBouncer mode transaksi (tanpa prepared statement bernama); vektor tulis-Next/baca-Laravel & sebaliknya untuk waktu dan kolom terenkripsi | programmer #1 | B | `web/src/server/db/**`, `web/drizzle.config.ts`, `web/tests/unit/db/**` | 60–90 mnt |
| **F. Jembatan sesi & permintaan** | `bacaPengguna()` dari cookie `sigap_session` + baris `sessions` (pakai `legacy/sesi`); pembaruan `last_activity`; flash milik Next; guard peran (`EnsureRole`, `EnsurePortalVerified`) & policy `TicketPolicy`/`UserPolicy` sebagai fungsi murni + test; `middleware.ts`: respons `409` + `X-Inertia-Location` untuk request ber-header `X-Inertia`, CSP ber-nonce identik `SecurityHeaders` (nonce ke skrip tema), header keamanan | programmer #2 | B, E | `web/src/middleware.ts`, `web/src/server/auth/**`, `web/src/server/http/{csp,flash}.ts`, `web/tests/unit/auth/**` | 90–120 mnt |
| **G. Runtime bersama** | klien Valkey (prefix `cc:`) + 9 rate limiter dengan angka Laravel (`AppServiceProvider.php:41-86`) dan fallback per-instance bila Valkey mati; pg-boss + proses `src/worker` + runner cron; tabel **outbox** + dispatcher (efek samping setelah commit); simpanan idempotency key 24 jam; penerbit event ke **Reverb lewat Pusher HTTP API** (tanda tangan HMAC, nama event & payload sama); jembatan cron Laravel: `SCHEDULE_DIPINDAH` di `bootstrap/app.php` (tanpa efek bila kosong) | programmer #1 (setelah E) | E | `web/src/server/{valkey,ratelimit,outbox,idempoten,realtime}/**`, `web/src/worker/**`, `sigap/bootstrap/app.php` (hanya blok jadwal) | 120–150 mnt |
| **H. Peta rute & jaringan** | `deploy/docker/nginx.conf`: `map` rute → upstream (`laravel`/`cc-web`), `location ^~ /_cc/`, resolver Docker; `scripts/pindah-rute.sh <slice> next\|laravel` dengan `nginx -t` + reload + catatan audit; terapkan jaringan `cc-edge` di server | devops | — | `deploy/docker/nginx.conf`, `deploy/docker/compose.yml`, `scripts/pindah-rute.sh` | 45–60 mnt + **persetujuan** untuk menerapkan di server |
| **I. Observabilitas** | OpenTelemetry di `web` & `worker` (HTTP, pg, axios), metrik dasar, log JSON ke stdout; collector + Prometheus/Grafana/Loki/GlitchTip self-host sebagai compose terpisah; alert & runbook awal §9.7 | devops | E, G | `web/src/instrumentation*.ts` (bagian OTel), `deploy/observabilitas/**`, `docs/runbook/**` | 90–120 mnt + **persetujuan** server |
| **J. Sandbox audit & uji coba audit** | sandbox Docker untuk skill `security-audit` (`--network none`, read-only, batas CPU/memori); audit `quick` scoped atas kode S0 (paket A, B, E, F, G) | devops + orkestrator | B–G | `scripts/sandbox-audit.sh`, `docs/slices/S0-keamanan.md` | 60–90 mnt |
| **K. Staging & gerbang S0** | stack staging terpisah di server (port & volume sendiri, snapshot DB anonim); deploy gelap Next.js di produksi (rute tetap ke Laravel); halaman `/_platform` membuktikan: membaca sesi login Laravel (warga & admin), mengirim event Reverb yang diterima halaman Laravel, layout 0 piksel; uji rollback peta rute | devops + QA | semua | `deploy/**`, `parity/**` (uji gerbang) | 90–120 mnt + **persetujuan** tiap langkah server |

Urutan: **B → E → (F ∥ G) → (H ∥ I) → J → K**. Paket H boleh disiapkan paralel sejak awal; hanya penerapannya di server yang menunggu.

## Gerbang S0 (selesai bila)

Di produksi, halaman tersembunyi `/_platform`:
1. menampilkan pengguna yang login di Laravel (warga dan admin) lewat jembatan sesi, dan logout di Laravel ikut terbaca;
2. mengirim event lewat Reverb yang diterima halaman admin Laravel;
3. tampil 0 piksel beda dengan layout Laravel;
4. pindah rute `/_platform` ke Next.js lalu kembali ke Laravel berhasil < 1 menit;
5. CI `web` & `paritas` hijau (termasuk suite visual Linux), audit keamanan tanpa temuan `confirmed` ≥ medium.

## Butuh dari pemilik proyek

| Langkah | Kapan |
|---|---|
| Terapkan jaringan `cc-edge` + peta rute nginx di server (nginx restart ±1–2 dtk) | paket H |
| Stack observabilitas di server | paket I |
| Stack staging + snapshot DB anonim | paket K |
| Deploy gelap & uji pindah rute `/_platform` | paket K |
