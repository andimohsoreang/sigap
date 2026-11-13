# Rencana Rewrite SIGAP ke Next.js

| Field | Nilai |
|---|---|
| Tanggal | 13 Nov 2026 |
| Pendamping | `docs/REWRITE-NEXTJS.md` (inventaris paritas, rujukan § di bawah mengarah ke sana) |
| Status | Draf untuk ditinjau |

---

## Keputusan

| Tanggal | Keputusan |
|---|---|
| 13 Nov 2026 | Database: **PostgreSQL** sebagai satu-satunya sumber kebenaran (tetap PG 16 yang sekarang sampai cutover; upgrade versi dilakukan terpisah setelah F6). Cache & rate limit dipindah ke Valkey (lihat baris di bawah) |
| 13 Nov 2026 | **Valkey** dipakai untuk rate limit, cache, kunci terdistribusi, state AI, dan pub/sub realtime. PostgreSQL tetap untuk data, antrean (pg-boss), dan sesi (§9.4) |
| 13 Nov 2026 | Backend mengikuti **praktik terbaik skala nasional** (diakses masyarakat seluruh Indonesia): standar di §9. Praktik terbaik tidak boleh mengubah perilaku atau tampilan (A6, §8) |
| 13 Nov 2026 | Strategi **per fitur** (slice), tiap fitur dibangun → dites → dideploy → dipantau sebelum lanjut. Fase F1–F7 di §2 digantikan oleh `docs/RENCANA-PER-FITUR.md`; F0 menjadi bagian S0. Disetujui 13 Nov 2026 |
| 13 Nov 2026 | Framework: **Next.js + TypeScript** (Astro dipertimbangkan, tidak dipilih: SIGAP aplikasi interaktif, bukan situs konten) |
| 13 Nov 2026 | Desain **identik 100%** dengan versi Laravel: 0 piksel beda pada screenshot pembanding. Aturan & gerbangnya di §8 |

## 0. Asumsi (perlu dikonfirmasi)

Rencana ini disusun dengan asumsi berikut. Kalau salah satu berubah, fase yang terdampak ditandai di kolom kanan.

| # | Asumsi | Terdampak bila berubah |
|---|---|---|
| A1 | Stack sesuai usulan: Next.js 16 (App Router) + Drizzle + pg-boss + sesi sendiri + server berprotokol Pusher (Soketi) | F1, F4, F5 |
| A2 | Container Docker, **bisa diskalakan horizontal** (beberapa replica web/worker), di infrastruktur yang **berlokasi di Indonesia** (§9.6). Lokasi final belum ditentukan — server dev pribadi sekarang tidak layak untuk layanan publik nasional | F1, F6 |
| A3 | **Sudah diputuskan.** Valkey untuk cache, rate limit, kunci, dan pub/sub realtime; antrean tetap pg-boss di PostgreSQL (§9.4) | F1, F4, F5 |
| A4 | Database produksi dipakai ulang apa adanya, tanpa migrasi data | F1, F6 |
| A5 | `/api/v1` dipertahankan untuk paritas (tidak ada klien eksternal yang diketahui, tapi murah dipertahankan) | F2, F3 |
| A6 | Paritas perilaku dulu, fitur baru belakangan. SLA tetap tanpa libur nasional; kanal SP4N/WBS tetap stub | semua |
| A7 | Satu developer utama dibantu AI, ditambah dukungan infrastruktur/ops paruh waktu untuk §9.3–9.7 dan pentest oleh pihak ketiga; estimasi di §6 memakai asumsi ini | §6 |
| A8 | Laravel dibekukan untuk fitur baru sejak F1 dimulai; hanya perbaikan bug yang masuk (dan ikut di-port) | semua |

---

## 1. Struktur proyek

Kode baru di repo yang sama, berdampingan dengan `sigap/`, supaya suite paritas bisa menguji keduanya dan
riwayat tetap satu.

```
sigap-repo/
├── sigap/                  # Laravel (dibekukan, dihapus di F7)
├── web/                    # Next.js baru
│   ├── src/app/
│   │   ├── (publik)/       # beranda, panduan, katalog, peta, lacak, survei, pengaduan, statis, rujukan
│   │   ├── (akun)/         # masuk, daftar, lupa-sandi, atur-ulang-sandi, verifikasi-email, aktivasi
│   │   ├── chat/           # halaman + route handler JSON /chat/*
│   │   ├── admin/          # panel admin (layout admin)
│   │   ├── portal-warga/
│   │   ├── api/v1/         # route handler API
│   │   └── broadcasting/auth/route.ts
│   ├── src/components/     # dipindah dari sigap/resources/js/components
│   ├── src/server/
│   │   ├── db/             # schema.ts (hasil pull), client, tx helper
│   │   ├── legacy/         # laravel-crypt.ts, nik.ts, bcrypt — kompatibilitas data lama
│   │   ├── auth/           # sesi, login, role guard, policy
│   │   ├── http/           # rate limiter, reCAPTCHA, CSP, flash, validasi
│   │   ├── tiket/ survei/ matriks/ unit/ master/ notifikasi/ audit/
│   │   └── modules/        # ai/, asisten/, pengetahuan/, contact-center/, rujukan/
│   ├── src/worker/         # proses pg-boss: job + cron
│   ├── src/cli/            # padanan perintah artisan (admin, rehash-nik, reset-transaksi, …)
│   └── tests/unit/         # Vitest, termasuk vektor dari fixtures/
├── parity/                 # suite Playwright/HTTP yang dijalankan ke Laravel DAN Next.js (BASE_URL)
│   └── fixtures/           # vektor uji JSON hasil ekspor PHP
├── deploy/docker/          # compose baru ditambahkan berdampingan (compose.next.yml)
└── docs/
```

Konvensi tetap: URL dan nama Indonesia, Conventional Commits, TS strict, ESLint + Prettier.

---

## 2. Fase

> **Digantikan** oleh rencana per fitur di `docs/RENCANA-PER-FITUR.md` (disetujui 13 Nov 2026). Isi di bawah
> dipertahankan sebagai acuan cakupan tiap area; F0 menjadi bagian S0.

Setiap fase punya **gerbang keluar**. Fase berikutnya tidak dimulai sebelum gerbangnya lulus, kecuali
ditulis "boleh paralel".

### F0 — Persiapan (tanpa kode Next.js)

| # | Tugas | Hasil |
|---|---|---|
| 0.1 | Konfirmasi asumsi §0 | asumsi dicoret/diganti di dokumen ini |
| 0.2 | Merge `feat/contact-center-ai` → `main`; `main` jadi basis rewrite; deploy produksi dari `main` | satu branch sumber kebenaran |
| 0.3 | Catat nilai produksi: `APP_TIMEZONE`, `SESSION_COOKIE`, `SANCTUM_STATEFUL_DOMAINS`, kunci (disimpan di vault/`.env` server, bukan di repo) | tabel §1 di dokumen inventaris terisi |
| 0.4 | Snapshot DB produksi + volume `storage` → staging rewrite | skrip `scripts/snapshot-staging.sh` |
| 0.5 | Artisan `sigap:ekspor-fixture` di Laravel: tulis vektor uji JSON (lihat daftar di bawah) | `parity/fixtures/*.json` |
| 0.6 | Suite paritas HTTP di `parity/`: port test black-box dari `tests/Feature/{Web,Api,Fixes,Infra}` + 2 spec e2e; jalankan **hijau terhadap Laravel** | suite + perintah `BASE_URL=… npx playwright test` |
| 0.7 | Checklist paritas: `route:list --json`, daftar halaman + bentuk props (dari ~150 `assertInertia`) | `parity/routes.json`, `parity/pages.md` |
| 0.8 | Baseline visual dari Laravel sesuai §8: semua halaman × state × viewport × tema, data & jam dibekukan | `parity/visual/` + baseline PNG + `parity/dom/*.html` |
| 0.9 | Putuskan nasib butir "tidak perlu ikut" (inventaris §8) | daftar final |

Vektor uji yang diekspor di 0.5:

- `SlaCalculator`: kombinasi dampak × kategori × tanggal mulai (termasuk Jumat sore, akhir pekan), plus status.
- Transisi status tiket: matriks dari → ke, diizinkan/tidak.
- `SurveyQuestionnaire`: jawaban → indeks SKM, mutu, flag tinjau ulang.
- Nomor tiket & `lookup_token`: pola regex + normalisasi input lacak.
- `IndonesianText`: kata → stem, kalimat → token (± 500 kata dari isi artikel nyata).
- `KnowledgeRetriever`: pertanyaan (fixture `uji-asisten` + 100 pertanyaan chat nyata yang dianonimkan) → id artikel/passage berurutan + skor.
- `ResponsePolicy`, `NumberGuard`, `PiiMasker`, `PortalDirectory`: input → output.
- `TicketIntake::kanalSql` & `TicketFilters`: baris tiket → kanal; query string → filter.
- Kripto: 20 pasang plaintext ↔ ciphertext `Crypt::encryptString` (kunci uji), NIK → hash.
- `ChatService::present()`: contoh pesan tiap jenis (teks, AI bersumber, portal, rujukan, aktivasi, lampiran, konfirmasi).

**Gerbang F0:** suite paritas hijau terhadap Laravel; fixtures lengkap; asumsi dikonfirmasi.

---

### F1 — Fondasi

| # | Tugas | Sumber Laravel |
|---|---|---|
| 1.1 | Scaffold `web/` (Next.js, TS strict, Tailwind 4, ESLint/Prettier, Vitest), `output: 'standalone'` | — |
| 1.2 | `drizzle-kit pull` dari snapshot → `schema.ts`; relasi ditulis manual; helper transaksi + `FOR UPDATE` | `database/migrations` |
| 1.3 | `legacy/laravel-crypt.ts` (baca & tulis, multi kunci), `legacy/nik.ts`, verifikasi bcrypt `$2y$` — lulus vektor kripto | `Encrypter`, `app/Support/Nik.php` |
| 1.4 | Lapisan kolom terenkripsi di Drizzle (custom type) untuk 4 kolom + `meta.aktivasi.token` | casts `encrypted` |
| 1.5 | Sesi di PG (tabel baru `web_sessions`), cookie httpOnly/secure/lax, CSRF (token double-submit atau Origin check), regenerasi saat login | `config/session.php` |
| 1.6 | Login NIK/username + dummy hash + audit; logout; invalidasi sesi lain saat ganti sandi | `AuthService`, `AuthenticateSession` |
| 1.7 | Guard peran (padanan `EnsureRole`, `EnsurePortalVerified`) di layout server + helper untuk route handler; policy `TicketPolicy`/`UserPolicy` sebagai fungsi murni + unit test | `app/Http/Middleware`, `app/Policies` |
| 1.8 | Rate limiter berbasis Valkey (sliding window) dengan 9 limiter dan angka yang sama | `AppServiceProvider.php:41-86` |
| 1.8b | Kerangka backend §9.2: lapisan handler → service → repo, env tervalidasi Zod, peta error, outbox, idempotency key, log pino dengan redaksi PII, OpenTelemetry | — |
| 1.8c | Infrastruktur §9.3–9.5: PgBouncer, role DB terpisah, Valkey, object storage S3-compatible untuk lampiran, graceful shutdown, health liveness/readiness, 2 replica web sejak staging | `deploy/docker` |
| 1.9 | reCAPTCHA v3 fail-closed; CSP ber-nonce via `middleware.ts`; header keamanan lain | `RecaptchaService`, `SecurityHeaders` |
| 1.10 | Flash message & pola "redirect back dengan error" untuk Server Actions | `HandleInertiaRequests` |
| 1.11 | Pindahkan `components/` + `ui/` + `lib/` + `hooks/` **tanpa mengubah JSX/className**; ganti `usePage().props` dengan konteks server; hapus Inertia | `resources/js` |
| 1.11b | Kerangka visual sesuai aturan §8: `app.css` disalin, versi Tailwind/font/ikon dikunci, skrip tema sebelum paint, progress bar navigasi, format judul. Bukti: CSS hasil build Next.js identik dengan `public/build` Laravel | `resources/css/app.css`, `app.blade.php`, `app.tsx` |
| 1.12 | Layout publik (`tara-shell`, `transi-header`), layout akun, layout admin (tanpa data dulu) | `admin-layout.tsx`, `tara-*` |
| 1.13 | Audit log (`activity_logs`), helper `Setting` dengan cache | `AuditService`, `Setting` |
| 1.14 | Worker pg-boss kosong + cron runner; CLI `admin` (buat akun admin) | `sigap:admin` |
| 1.15 | Compose staging: `web`, `worker`, `db` (snapshot), CI (lint, typecheck, unit, build) | `deploy/docker` |

**Gerbang F1:** login dengan akun produksi asli (NIK & username) berhasil di staging; NIK lama terbaca;
suite paritas bagian auth, rate limit, CSP, dan akses peran hijau terhadap Next.js.

---

### F2 — Alur tiket

| # | Tugas | Sumber Laravel |
|---|---|---|
| 2.1 | Domain tiket: `SlaCalculator`, transisi status, nomor tiket, `findForPublicLookup`, `TicketIntake`, `TicketFilters`, `Search` — lulus vektor | `TicketService`, `app/Support/*` |
| 2.2 | Lampiran tiket: deteksi MIME, simpan `lampiran/{uuid}`, unduh lewat handler dengan cek policy + audit | `AttachmentService` |
| 2.3 | Formulir pengaduan publik, internal; lacak (termasuk `?kode=` nomor lama); redirect lama 301 | `PengaduanFormController`, `PublicController` |
| 2.4 | Survei v2 + tampilan survei v1; pengingat survei (cron 09:00) | `SurveyService`, `SurveyReminderCommand` |
| 2.5 | Admin: daftar tiket, detail, ubah status, tanggapan, tinjau ulang, input manual, tiket internal | `AdminController` |
| 2.6 | Unit kerja (pohon), disposisi + tarik, petugas (buat, email, unit) | `UnitController`, `DispositionService` |
| 2.7 | Portal warga: profil, daftar tiket, unduh lampiran, hapus tiket berstatus `baru` | `WargaPortalController` |
| 2.8 | Akun warga: daftar, verifikasi email (URL bertanda tangan), lupa/atur ulang sandi, ganti email | `AccountService`, `DaftarController`, … |
| 2.9 | Notifikasi: `NotificationService` (in-app + email), `ReporterNotifier`, template surel (React Email) — dikirim **setelah commit** lewat pg-boss | `app/Mail`, `app/Notifications`, `resources/views/mail` |
| 2.10 | EWS (cron 07:00) | `EwsCheckCommand` |
| 2.11 | `/api/v1` bagian pengaduan, tiket, survei, katalog, warga, admin tickets | `routes/api.php` |

**Gerbang F2:** spec `alur-utama` + test paritas tiket/survei/akun/disposisi hijau; surel terkirim ke Mailpit di
staging; tiket yang dibuat Next.js terbaca benar oleh Laravel (bukti kompatibilitas dua arah).

---

### F3 — Rekap & master data (boleh paralel dengan akhir F2)

| # | Tugas | Sumber Laravel |
|---|---|---|
| 3.1 | `MatrixService` → query Drizzle/SQL mentah; perbandingan angka langsung terhadap Laravel di snapshot yang sama | `MatrixService` |
| 3.2 | `StatsService` (beranda publik, cache 60 dtk) | `StatsService` |
| 3.3 | Halaman `admin/matriks` dengan `charts`, `province-map` | `admin/matriks.tsx` |
| 3.4 | Master: kawasan, kanal + sinkron stub, kategori, pengaturan + kanal publik, log aktivitas | `AdminController` |
| 3.5 | Halaman publik statis + beranda (berita resmi dengan cache & penundaan) + katalog + peta | `PublicController`, `OfficialNews` |
| 3.6 | `/api/v1` rekap, kawasan, kanal, pengaturan, admins, integrasi | `routes/api.php` |

**Gerbang F3:** skrip pembanding mengeluarkan angka matriks identik Laravel vs Next.js untuk 5 kombinasi filter
pada snapshot produksi; tangkapan layar admin cocok secara visual.

---

### F4 — Contact center

| # | Tugas | Sumber Laravel |
|---|---|---|
| 4.1 | Server realtime (Soketi) + `/broadcasting/auth` dengan aturan 3 channel; event setelah commit | `routes/channels.php`, `app/Events` |
| 4.2 | Ganti `@laravel/echo-react` → klien Pusher; fallback polling tetap | `lib/reverb`, `use-chat-unread` |
| 4.3 | `ChatService`: kirim, unread atomik, `present()` identik (lulus vektor), tandai baca, transkrip | `ChatService` |
| 4.4 | Identitas tamu: sesi + cookie 30 hari, adopsi percakapan tamu saat login | `ChatController:44-49, 413-428` |
| 4.5 | Endpoint `/chat/*` (14) dengan limiter masing-masing; lampiran chat dengan sharp (strip EXIF, rotasi, ≤ 2000 px) | `ChatController`, `ChatAttachmentService` |
| 4.6 | Admin chat: ambil alih, tutup, balas, rujuk, konfirmasi data, buat akun & pulihkan akun dari chat, aktivasi (`/aktivasi/{token}`) | `ContactCenterController`, `StaffRegistrationService` |
| 4.7 | Rujukan & portal: alur status, kode bukti, penugasan, pengingat (cron), cek portal (cron), halaman publik `/rujukan/{token}` | `app/Modules/Referral` |
| 4.8 | Lencana unread & notifikasi lonceng di layout admin | `notification-bell` |
| 4.9 | Handoff manual (tanpa AI dulu) + jam layanan | `Handoff`, ServiceHours |

**Gerbang F4:** spec `live-chat` + test paritas chat/rujukan/aktivasi hijau; uji dua browser (warga + petugas)
pesan muncul < 1 detik; 200 koneksi WebSocket simultan stabil di staging.

---

### F5 — TARA & pengetahuan

| # | Tugas | Sumber Laravel |
|---|---|---|
| 5.1 | `IndonesianText` (stemmer, stopword, sinonim) — lulus 100% vektor stem/token | `IndonesianText.php` |
| 5.2 | `KnowledgeRetriever` BM25 + cache indeks — urutan hasil identik pada vektor retrieval | `KnowledgeRetriever.php` |
| 5.3 | `AiGateway`: klien OpenAI-compatible, breaker, token budget, batas per percakapan, masking PII, catat `ai_calls` (state di PG) | `app/Modules/Ai` |
| 5.4 | Prompt disalin byte-identik + `prompt_version`; teks tetap `lang/id/asisten.php` | `Prompts/*`, `lang/id` |
| 5.5 | `Consultation` → `ResponsePolicy` → `ReplyComposer`; `NumberGuard`; `TicketLookup`; `TicketSuggester` — lulus 16 kasus policy + 31 golden reply | `app/Modules/Assistant` |
| 5.6 | Jalur async: job `respond-to-message` di antrean `ai` (singleton per pesan, satu per percakapan, timeout 60 dtk → handoff `ai_gagal`), cron `ai-macet` tiap 15 dtk | `RespondToMessage`, `AiMacetCommand` |
| 5.7 | Ingest: fetcher dengan allowlist + cek tiap redirect, ekstraktor HTML/PDF/DOCX, chunking, hash; job sinkron (Senin 02:00) | `app/Modules/Knowledge/Ingestion` |
| 5.8 | Dokumen pengetahuan + usul artikel; halaman pengetahuan, tinjau, sumber, dokumen; berkas publik | `KnowledgeDocumentService`, controller pengetahuan |
| 5.9 | Kesehatan AI + CLI `uji-asisten` (cron Senin 03:00) dengan gerbang yang sama | `AiHealth`, `UjiAsistenCommand` |
| 5.10 | Ukur ulang: jalankan `uji-asisten` di Laravel dan Next.js pada snapshot yang sama, setelah sinkron ulang sumber | — |

**Gerbang F5:** vektor retrieval & policy 100% cocok; `uji-asisten` Next.js ≥ hasil Laravel
(pencarian ≥ 95, klasifikasi ≥ 85, tanpa sumber = 0, p95 ≤ 12 dtk); selisih passage akibat ekstraktor baru
ditinjau dan diterima.

---

### F6 — Paritas penuh & cutover

| # | Tugas |
|---|---|
| 6.1 | Seluruh suite paritas hijau terhadap Next.js, termasuk suite visual §8 dengan 0 piksel beda di semua halaman |
| 6.2 | CLI sisa: `rehash-nik`, `reset-transaksi`, `data-contoh`, `e2e-setup`; prune harian 02:00 |
| 6.3 | Uji kinerja & ketahanan §9.8 (k6 beban, spike 10×, soak 4 jam, uji kegagalan komponen) sampai target §9.1 tercapai |
| 6.4 | Keamanan: checklist OWASP ASVS L2, SAST + DAST di CI/staging, **pentest pihak ketiga**, tinjauan kepatuhan UU PDP & PP 71/2019 (§9.6) |
| 6.4b | DR drill: restore PITR ke server baru dalam batas RTO; observabilitas & alert §9.7 aktif dengan runbook |
| 6.5 | Runbook cutover + rollback di `docs/DEPLOY.md`; `scripts/deploy.sh` mendukung stack baru (tag SHA, backup, rollback) |
| 6.6 | Gladi cutover di staging dengan snapshot terbaru, termasuk gladi rollback ke Laravel |
| 6.7 | Uji terima pengguna (UAT) oleh petugas contact center 2–3 hari di staging |
| 6.8 | **Cutover produksi** (lihat urutan di bawah) |

Urutan cutover (perkiraan jendela 30 menit, di luar jam layanan, mis. Sabtu pagi):

1. Pengumuman pemeliharaan; aktifkan halaman pemeliharaan di nginx.
2. Hentikan `queue`, `queue-ai`, `scheduler` Laravel; tunggu antrean `jobs` kosong.
3. `scripts/backup.sh` (DB + storage).
4. Jalankan migrasi Drizzle tambahan (hanya aditif: tabel sesi, outbox, idempotensi, skema pg-boss, indeks `pg_trgm`).
5. Naikkan `web`, `worker`, `realtime` baru; arahkan nginx/Tunnel ke `web`.
6. Smoke test: lacak tiket, login admin & warga, kirim chat, jawaban TARA, unggah lampiran.
7. Matikan halaman pemeliharaan. Semua sesi lama hangus → pengguna login ulang (umumkan).

Rollback: karena F1–F5 tidak mengubah tabel lama, rollback = arahkan nginx kembali ke container Laravel,
hidupkan lagi worker Laravel. Data yang dibuat Next.js tetap terbaca Laravel (dibuktikan di gerbang F2).
Jendela rollback dipertahankan 2 minggu.

**Gerbang F6:** produksi berjalan di Next.js 7 hari tanpa insiden P1.

---

### F7 — Pasca cutover

- Hapus folder `sigap/` dan image Laravel setelah jendela rollback lewat.
- Drop tabel framework Laravel (`sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`,
  `personal_access_tokens`, `password_reset_tokens` bila tidak dipakai lagi); `migrations` diarsipkan.
- Tulis ulang `docs/TECH-SPEC.md`, `docs/DEPLOY.md`, dan `openapi.yaml` dari kode baru.
- Opsional: migrasi kolom terenkripsi ke format baru (rotasi kunci), libur nasional di SLA, `jsonb`.

---

## 3. Yang dikerjakan paralel

```
F0 ──► F1 ──► F2 ──────────► F4 ──► F5 ──► F6 ──► F7
                └──► F3 ──┘
```

- F3 bisa jalan bersamaan dengan paruh akhir F2 (hanya butuh domain tiket dari 2.1).
- 5.1–5.2 (stemmer + BM25) murni fungsi; boleh dikerjakan kapan saja setelah F0 sebagai "pekerjaan selingan".
- Suite paritas terus ditambah sepanjang fase.

---

## 4. Strategi test

| Lapis | Alat | Isi |
|---|---|---|
| Vektor | Vitest + `parity/fixtures` | logika murni harus identik dengan PHP |
| Unit | Vitest | policy, limiter, kripto, komponen (52 test Vitest lama dibawa) |
| Paritas HTTP/E2E | Playwright di `parity/` | dijalankan ke Laravel dan Next.js; CI menjalankan ke Next.js |
| Visual | Playwright `toHaveScreenshot` + diff DOM | otomatis, toleransi 0 piksel (§8); jalan di CI tiap PR |
| AI | CLI `uji-asisten` | gerbang kualitas F5 |

Test PHPUnit yang hanya menguji internal Laravel (migrasi, arsitektur modul) tidak di-port.

---

## 5. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Ciphertext/NIK hash salah baca | login NIK gagal, data warga tak terbaca | F1 gerbang wajib pakai akun & data produksi asli di staging |
| Ranking TARA bergeser | jawaban salah sumber | vektor retrieval 100% + `uji-asisten` sebelum/sesudah |
| Teks ekstraktor PDF beda | passage berubah, sitasi halaman beda | terima sebagai perubahan sekali, tinjau selisih di 5.10 |
| Zona waktu | SLA/nomor tiket/cron meleset | 0.3 catat `APP_TIMEZONE`; semua tanggal domain lewat satu util WIB |
| Laravel terus berubah saat rewrite | paritas mengejar target bergerak | A8 freeze; bug fix wajib disertai test paritas |
| Realtime di belakang Cloudflare Tunnel | WebSocket putus | uji 4.1 lewat Tunnel di staging, bukan hanya localhost |
| Hosting sekarang (server dev pribadi, domain pribadi) dipakai untuk layanan nasional | gangguan tanpa cadangan, tidak patuh PP 71/2019 | tentukan lokasi produksi final di Indonesia sebelum F6 (§7) |
| Lonjakan trafik nasional | layanan lambat/mati saat paling dibutuhkan | target §9.1, Valkey, PgBouncer, replica, CDN, uji spike §9.8 |
| Data warga ke penyedia AI di luar negeri | pelanggaran PP 71/2019 / UU PDP | verifikasi lokasi penyedia `AI_BASE_URL` atau host model sendiri (§9.6) |
| Estimasi meleset | cutover mundur | gerbang per fase; F5 bisa ditunda dengan TARA mati sementara (`AI_ENABLED=false` sudah didukung) |

---

## 6. Estimasi kasar

Satu developer penuh waktu dengan bantuan AI. Angka ini perkiraan awal, ditinjau ulang di akhir F1.

| Fase | Minggu |
|---|---|
| F0 Persiapan | 1–1,5 |
| F1 Fondasi | 1,5–2 |
| F2 Tiket | 2–3 |
| F3 Rekap & master | 1,5–2 (sebagian paralel) |
| F4 Contact center | 2–3 |
| F5 TARA & pengetahuan | 2,5–3,5 |
| F6 Paritas & cutover | 1–1,5 |
| Paritas visual 0 piksel (§8), tersebar di F0–F6 | +1–2 |
| Standar backend nasional (§9): infrastruktur, observabilitas, uji kinerja, keamanan | +2–3 |
| Pentest pihak ketiga + perbaikan temuan | +1 (paralel dengan UAT) |
| **Total** | **~15–22 minggu** |

---

## 7. Keputusan yang dibutuhkan sebelum F1

1. Konfirmasi A1–A8.
2. Nama folder (`web/`) dan apakah tetap satu repo.
3. Tanggal freeze fitur Laravel.
4. Siapa melakukan UAT di F6.
5. **Lokasi hosting produksi** di Indonesia (pusat data pemerintah / cloud lokal) dan domain resmi (`.go.id`).
6. Penyedia AI: lokasi data penyedia sekarang, atau model di-host sendiri (§9.6).
7. Data trafik nyata untuk mengganti asumsi §9.1.

---

## 8. Paritas visual (desain identik 100%)

Target: setiap halaman Next.js menghasilkan **piksel yang sama persis** dengan Laravel untuk data, ukuran layar,
tema, dan browser yang sama. Ini dibuktikan oleh mesin, bukan dinilai dengan mata.

### 8.1 Aturan porting (wajib)

| Aturan | Alasan |
|---|---|
| JSX dan `className` halaman serta komponen disalin apa adanya. Yang boleh diubah hanya cara data masuk (props Inertia → props server) dan cara submit (Inertia `useForm`/`router` → Server Action/fetch) | Struktur DOM sama = render sama |
| `resources/css/app.css` disalin utuh, termasuk `@theme`, variabel tema, dan kelas `a11y-*` | |
| Versi dikunci persis (tanpa `^`): `tailwindcss` & `@tailwindcss/postcss` **4.0.8**, `tailwindcss-animate`, `tailwind-merge` 3.0.2, `lucide-react` 0.475.0, `@fontsource/*`, Radix, `@headlessui/react`, `leaflet` 1.9.4. React boleh 19.x yang sama major | Beda versi Tailwind/ikon bisa menggeser 1 piksel |
| Font tetap lewat `@fontsource` di CSS. **Jangan pakai `next/font`** | `next/font` mengganti nama family dan menambah fallback metrics |
| **Jangan pakai `next/image`**; tetap `<img>` biasa dengan atribut yang sama | `next/image` mengubah markup, ukuran, dan lazy loading |
| `next/link` boleh (merender `<a>` biasa), tanpa prefetch yang mengubah perilaku | |
| Kerangka `<html>` sama: `lang` sama dengan Laravel (sekarang `en` karena `APP_LOCALE`), `<body class="font-sans antialiased">`, skrip tema & aksesibilitas inline sebelum paint (kunci `cc-theme`, `cc-a11y`) | Mencegah kedip tema & beda kelas root |
| Format judul tab: `"{judul} - Contact Center"`, kecuali judul sudah memuat nama aplikasi | `app.tsx` |
| Progress bar navigasi meniru Inertia (NProgress, warna `#4B5563`, muncul setelah 250 ms) | Inertia menampilkannya; App Router tidak |
| **Tidak ada `loading.tsx`/skeleton baru.** Saat pindah halaman, halaman lama tetap tampil sampai yang baru siap, seperti Inertia | Perilaku transisi harus sama |
| Flash, error validasi, dan toast muncul di posisi & waktu yang sama (pola redirect back) | |
| Favicon, `logo.svg`, `public/images`, `public/geo` disalin byte-identik | |

### 8.2 Bukti di F1 (sebelum halaman apa pun di-port)

1. **CSS identik:** build Laravel (`public/build/assets/app-*.css`) dan build Next.js dibandingkan setelah
   dinormalisasi (urutan aturan, nama file aset). Harus sama aturan per aturan.
2. **Halaman kosong identik:** layout publik & admin tanpa data → screenshot 0 piksel beda.

### 8.3 Suite visual

| Dimensi | Nilai |
|---|---|
| Browser | Chromium versi yang sama (dikunci lewat versi Playwright), font sistem dari container Docker yang sama |
| Viewport | 375×812 (ponsel), 768×1024 (tablet), 1440×900 (desktop) |
| Tema | terang, gelap; plus 1 kombinasi aksesibilitas (teks besar + kontras + disleksia) |
| Halaman | seluruh 42 halaman, per peran yang bisa membukanya |
| State | kosong, berisi, error validasi, flash sukses, modal/dialog terbuka, dropdown terbuka, chat: tamu/login/ditangani TARA/ditangani petugas/di luar jam layanan |
| Data | snapshot DB yang sama untuk kedua aplikasi, jam dibekukan (`page.clock`), angka acak & nomor dari fixture |
| Gerak | animasi & transisi dimatikan saat capture, caret disembunyikan |
| Toleransi | `maxDiffPixels: 0`, `threshold: 0` |

Selain piksel, **DOM juga dibandingkan**: HTML tiap halaman (setelah membuang atribut yang memang berbeda,
mis. nonce, `data-page` Inertia, id acak Radix) harus sama elemen dan kelasnya. Diff DOM menunjukkan
*di mana* beda saat screenshot gagal.

Pengecualian yang **di-mask** (konten dari luar yang tidak kita kendalikan), dicatat eksplisit di config:

- Tile peta OpenStreetMap (bingkai, kontrol, marker, dan choropleth tetap dibandingkan).
- Badge reCAPTCHA Google.
- Gambar berita dari transmigrasi.go.id (diganti fixture saat test; tata letaknya tetap dibandingkan).

Di luar daftar itu, tidak ada mask dan tidak ada toleransi.

### 8.4 Gerbang

- Setiap fase F2–F5 hanya lulus bila halaman yang di-port di fase itu 0 piksel beda di semua kombinasi §8.3.
- Suite visual jalan di CI tiap PR; PR yang membuat satu piksel pun beda tidak boleh di-merge.
- Bila ternyata perlu beda (mis. bug tampilan di Laravel), itu **bukan** bagian rewrite: catat, perbaiki
  setelah cutover sebagai perubahan terpisah.

---

## 9. Standar backend (skala nasional)

SIGAP akan diakses masyarakat dari seluruh Indonesia. Praktik terbaik di bagian ini adalah yang **tidak terlihat
oleh pengguna**: struktur kode, kapasitas, keandalan, keamanan, dan observabilitas. Perilaku, URL, tampilan, dan
format respons `/api/v1` tetap identik (A6, §8). Perbaikan yang terlihat dicatat sebagai backlog pasca cutover
(§9.9).

### 9.1 Target kapasitas & SLO

Angka di bawah adalah **asumsi kerja**. Di F0, ambil data nyata 30 hari terakhir dari Cloudflare Analytics dan
log nginx produksi, lalu sesuaikan.

| Ukuran | Target |
|---|---|
| Ketersediaan | 99,9% per bulan (≈ 43 menit gangguan) |
| Latensi server p95 | halaman publik < 300 ms; aksi admin < 500 ms; kirim pesan chat < 200 ms; jawaban TARA ≤ 12 dtk (sudah ada) |
| Beban rancangan | 300 request/dtk puncak, 5.000 pengguna aktif bersamaan, 1.000 koneksi WebSocket |
| Ruang tumbuh | 10× beban rancangan dengan menambah replica, tanpa ubah kode |
| Lonjakan | tahan spike 10× selama 15 menit (mis. viral di media sosial, bencana) dengan degradasi anggun |
| RPO / RTO | kehilangan data ≤ 5 menit / pulih ≤ 1 jam |

### 9.2 Arsitektur kode

| Praktik | Penerapan |
|---|---|
| Lapisan jelas | `app/**` (page, route handler, Server Action) tipis → `server/<domain>/service.ts` (aturan bisnis, transaksi) → `repo.ts` (Drizzle). Kode domain tidak mengimpor Next.js. Batas diperiksa ESLint (`import/no-restricted-paths`), padanan test `ModuleBoundaries` Laravel |
| Validasi di setiap batas | Zod untuk input HTTP, env, payload job, respons AI, dan event realtime |
| Konfigurasi | env divalidasi Zod saat start; aplikasi menolak jalan bila kunci wajib kosong atau `APP_DEBUG`-padanan aktif di produksi |
| Error | kelas error domain dipetakan ke HTTP di satu tempat; respons tidak pernah membawa stack trace; bentuk respons sama dengan Laravel |
| Transaksi & efek samping | efek samping (surel, broadcast, job) ditulis ke **outbox** dalam transaksi yang sama lalu dikirim dispatcher → tidak ada surel untuk tiket yang gagal tersimpan, tidak ada tiket tanpa notifikasi |
| Idempotensi | kirim pengaduan, survei, pesan chat, lampiran memakai idempotency key (dibuat klien, disimpan 24 jam) → koneksi seluler putus-sambung tidak membuat tiket ganda. Tidak mengubah tampilan |
| Konkurensi | `SELECT … FOR UPDATE` di tempat yang sama dengan Laravel; unique constraint DB sebagai jaring terakhir |
| Query | semua daftar dibatasi & berindeks; tidak ada query N+1 (dicek di test dengan penghitung query); ekspor & job memakai keyset pagination |
| Log | JSON terstruktur (pino) dengan request id & trace id; NIK, email, telepon, isi chat di-redact |
| Test | logika domain ≥ 90% coverage; vektor PHP (F0) + suite paritas + suite visual |

### 9.3 Data & PostgreSQL

- PostgreSQL tetap satu-satunya sumber kebenaran data.
- **PgBouncer** (transaction pooling) di depan PostgreSQL, supaya banyak replica web/worker tidak menghabiskan koneksi.
- **Role DB terpisah**: `sigap_app` (DML saja), `sigap_migrate` (DDL), `sigap_readonly` (laporan & replica).
  `statement_timeout` dan `idle_in_transaction_session_timeout` per role.
- **Indeks pencarian**: `LOWER(col) LIKE '%…%'` tidak bisa memakai indeks biasa. Tambah ekstensi `pg_trgm` +
  indeks GIN di kolom yang dicari. Aditif, hasil pencarian tetap sama, Laravel tetap jalan.
- Semua query rekap/matriks diperiksa `EXPLAIN ANALYZE` di snapshot produksi. Bila perlu: **read replica** untuk
  rekap, atau tabel rollup harian yang diisi job (angka harus tetap identik, gerbang F3).
- **Backup**: pgBackRest atau WAL-G dengan point-in-time recovery, terenkripsi, salinan kedua di lokasi lain
  **di Indonesia**; uji restore otomatis tiap bulan.
- **Migrasi expand–contract**: selama jendela rollback hanya perubahan aditif; penghapusan kolom/tabel di F7.

### 9.4 Valkey untuk cache, rate limit, dan realtime (disetujui 13 Nov 2026)

Alasan: di skala nasional, menaruh cache dan rate limit di PostgreSQL berarti setiap request
menulis ke database utama, dan beban itu naik paling tajam justru saat lonjakan — ketika database paling butuh
ruang. Pembagian:

| Kebutuhan | Tempat |
|---|---|
| Data (tiket, chat, akun, dst.) | PostgreSQL |
| Antrean job + outbox | PostgreSQL (pg-boss) — tahan lama & bisa ikut transaksi |
| Sesi | PostgreSQL (jarang ditulis), cache baca di Valkey |
| Rate limit, cache (statistik, indeks BM25, setting), kunci terdistribusi, state AI (breaker, token budget, batas per percakapan) | **Valkey** |
| Pub/sub antar-instance Soketi | **Valkey** |

Valkey = fork Redis yang sepenuhnya open source (Linux Foundation), kompatibel dengan klien Redis. Bila Valkey
mati, aplikasi tetap jalan: rate limit jatuh ke batas konservatif per-instance, cache dibaca langsung dari DB.

### 9.5 Skala horizontal & ketahanan

- **Web stateless**: tidak ada state di memori proses; sesi di DB/Valkey; file di object storage → web bisa
  N replica di belakang load balancer.
- **Lampiran ke object storage S3-compatible** yang berlokasi di Indonesia (MinIO self-host atau penyedia lokal).
  Path di DB tidak berubah. Laravel dikonfigurasi memakai disk S3 yang sama **sebelum** cutover, supaya rollback
  tetap mungkin. Unduhan tetap lewat handler yang mengecek otorisasi (tanpa URL publik).
- **Worker per antrean** (`ai`, `default`, `ingest`) dapat diskalakan terpisah; job berat (PDF 20 MB, crawl)
  tidak menahan jawaban TARA.
- **Soketi** ≥ 2 instance dengan adapter Valkey.
- **CDN**: aset ber-hash (`immutable`), `/geo/*`, gambar di-cache Cloudflare. HTML tidak di-cache di edge karena
  tergantung sesi.
- **Degradasi anggun**: AI mati → percakapan langsung ke petugas (sudah ada); berita resmi gagal → tampilkan
  cache lama (sudah ada); Valkey mati → lihat §9.4; replica web mati → load balancer mengalihkan.
- **Graceful shutdown**: SIGTERM → berhenti menerima request, selesaikan request & job berjalan.
- **Health**: `/up` (liveness, proses hidup) dan `/api/v1/health` (readiness: DB + Valkey).
- Timeout & retry dengan backoff + jitter untuk semua panggilan keluar (AI, reCAPTCHA, berita, ingest, portal).

### 9.6 Keamanan & kepatuhan

| Area | Praktik |
|---|---|
| Standar | **OWASP ASVS Level 2** sebagai checklist; diverifikasi di F6 |
| UU 27/2022 (Pelindungan Data Pribadi) | inventaris data pribadi & dasar pemrosesannya; minimisasi; retensi (prune sudah ada, ditinjau ulang); enkripsi NIK & kontak (sudah); log akses data pribadi (audit sudah); prosedur pemberitahuan kebocoran data maksimal 3×24 jam; penunjukan pejabat PDP di pihak Kementerian |
| PP 71/2019 (PSE lingkup publik) | pengelolaan, pemrosesan, dan penyimpanan data di Indonesia: hosting, backup, object storage, log & observabilitas, **dan penyedia AI**. Teks chat warga (meski sudah di-mask) dikirim ke `AI_BASE_URL` → penyedia dan lokasinya harus diizinkan, atau model di-host sendiri di Indonesia |
| Edge | Cloudflare WAF + rate limit edge + proteksi bot, di samping reCAPTCHA (tetap) |
| Upload | cek magic byte, batasi ukuran sebelum dibaca penuh, re-encode gambar (tetap), PDF disajikan dengan CSP sandbox (tetap), pindai antivirus (ClamAV) di worker |
| SSRF ingest | allowlist host (tetap) + tolak IP privat/loopback/link-local **setelah** resolve DNS + cek ulang tiap redirect |
| Sesi | cookie `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`; ganti id sesi saat login; invalidasi saat ganti sandi (tetap) |
| Rahasia | tidak pernah di repo/image; file env `600` atau secret manager; rotasi `APP_KEY` didukung lewat previous keys |
| Supply chain | lockfile + `npm ci`; Renovate; `npm audit`/OSV-Scanner di CI; image dasar minimal, user non-root, filesystem read-only |
| Pengujian keamanan | SAST (Semgrep/CodeQL) tiap PR; DAST (OWASP ZAP) di staging; **pentest pihak ketiga sebelum cutover** |

### 9.7 Observabilitas

- **OpenTelemetry**: trace dari request → query DB → job → panggilan AI.
- Metrik (Prometheus), log terpusat (Loki), dashboard (Grafana), error tracking (GlitchTip/Sentry self-host) —
  semua di-host di Indonesia.
- Alert: tingkat error, p95, antrean `ai` menumpuk, koneksi DB, replikasi, disk, sertifikat, backup gagal,
  token budget AI, lonjakan 429.
- Setiap alert punya runbook di `docs/runbook/`.

### 9.8 Uji kinerja & ketahanan

| Uji | Isi |
|---|---|
| Beban (k6) | lacak tiket, kirim pengaduan, beranda, chat via WebSocket, panel admin — sampai target §9.1 |
| Spike | 10× beban selama 15 menit |
| Soak | beban normal 4 jam; cari kebocoran memori & koneksi |
| Kegagalan | matikan 1 replica web, worker, Soketi, Valkey; putuskan AI & SMTP → layanan tetap jalan / degradasi anggun |
| DR | restore PITR ke server kosong dalam batas RTO |

Dijalankan di staging dengan ukuran setara produksi, bukan di laptop.

### 9.9 Backlog setelah cutover (praktik baik yang mengubah perilaku)

Tidak dikerjakan di rewrite karena melanggar paritas, tapi disarankan segera sesudahnya:

- MFA untuk akun admin dan petugas.
- Format error API standar (RFC 9457) di `/api/v2`.
- Libur nasional di perhitungan SLA.
- `json` → `jsonb`, kolom waktu → `timestamptz`.
- Pindah dari format enkripsi Laravel ke format baru + rotasi kunci.
