# Rencana Rewrite per Fitur (Slice)

| Field | Nilai |
|---|---|
| Tanggal | 13 Nov 2026 |
| Menggantikan | Fase F1–F7 di `docs/RENCANA-REWRITE-NEXTJS.md` §2 (keputusan, §8 paritas visual, §9 standar backend tetap berlaku) |
| Inventaris | `docs/REWRITE-NEXTJS.md` |
| Status | **Disetujui 13 Nov 2026** — strategi per fitur menggantikan cutover sekaligus |
| Basis fitur | **Semua fitur yang berjalan di produksi** (`app2`), saat ini commit `f8713a0` di `feat/contact-center-ai` |

---

## 1. Cara kerjanya

Laravel dan Next.js berjalan **bersamaan di produksi** dengan database yang sama. Di depan keduanya ada nginx
yang menentukan setiap URL dilayani siapa. Satu fitur selesai = rutenya dipindah ke Next.js. Laravel menyusut
fitur demi fitur sampai kosong, lalu dimatikan.

```
            Cloudflare
                │
              nginx  ── peta rute (routes.map): /lacak → next, /admin/tiket → laravel, …
             ┌──┴───────────┐
          Next.js         Laravel
             │  \         /   │
             │   PostgreSQL   │
          worker   Valkey   queue/scheduler
             └──── Reverb ────┘   (satu server WebSocket bersama sampai S16)
```

Kenapa aman:

- **Rollback per fitur = 1 baris** di peta rute nginx, kembali ke Laravel dalam < 1 menit. Database tidak berubah
  bentuk (hanya penambahan), dan Next.js menulis data dalam format yang sama dengan Laravel (enkripsi, nomor,
  status), jadi data yang dibuat salah satu aplikasi selalu terbaca oleh yang lain.
- **Dampak gangguan kecil**: yang berisiko hanya fitur yang baru dipindah, bukan seluruh aplikasi.
- **Umpan balik cepat**: pengguna nyata memakai hasil rewrite sejak minggu-minggu awal.

Harganya: perlu "jembatan" (S0) supaya dua aplikasi bisa hidup berdampingan — membaca sesi login Laravel, menangani
navigasi Inertia, berbagi server WebSocket, dan membagi jadwal cron. Tambahan kerja sekitar 1–2 minggu dibanding
cutover sekaligus.

---

## 1a. Basis fitur = produksi

Yang ditulis ulang adalah **persis apa yang berjalan di produksi**, bukan isi branch lain atau pekerjaan yang
belum dirilis.

- Per 13 Nov 2026 produksi menjalankan `feat/contact-center-ai` @ `f8713a0` (dicek langsung di server: tanpa
  perubahan lokal) (fitur terakhir: survei SKM v2 —
  terkonfirmasi lewat `/api/v1/survei/kuesioner` yang mengembalikan `versi: 2`). `main` dan
  `feat/beranda-makarti` tidak punya commit di luar commit ini.
- Pekerjaan yang **belum dirilis** ke produksi (mis. perubahan beranda yang belum di-commit di worktree
  `sigap-beranda-makarti`) **tidak** termasuk basis. Bila dirilis sebelum freeze, ikut masuk basis.
- **Freeze dimulai hari S0 dimulai** (diputuskan 13 Nov 2026). Saat freeze (S0, langkah 0.1): catat commit yang benar-benar ter-checkout di server
  (`ssh srvr-dev-andy 'cd /opt/app2-sigap && git log -1 && git status --porcelain'`), pastikan tidak ada perubahan
  lokal di server, lalu tag commit itu `laravel-baseline`. Baseline screenshot, vektor uji, dan suite paritas
  diambil dari tag ini.
- Setelah freeze, setiap rilis Laravel ke produksi (perbaikan bug) menggeser tag dan wajib ikut di-port ke slice
  terkait.

## 2. Siklus setiap fitur (Definition of Done)

Setiap slice melewati 9 langkah yang sama. Slice berikutnya boleh mulai dibangun saat slice sebelumnya masuk
langkah 7, tapi **tidak boleh dipindah ke produksi** sebelum slice sebelumnya lulus langkah 8.

| # | Langkah | Hasil / bukti |
|---|---|---|
| 1 | **Spesifikasi slice**: daftar rute, halaman, endpoint, job, cron, tabel, event, dan surel yang dicakup (diambil dari inventaris) | checklist di `docs/slices/Sxx.md` |
| 2 | **Test dulu**: test paritas HTTP, vektor logika, suite visual, dan template surel untuk slice ini — dijalankan **hijau terhadap Laravel** | PR test |
| 3 | **Bangun** di Next.js mengikuti §8 (desain) & §9 (backend) | PR fitur |
| 4 | **Test hijau terhadap Next.js**: unit, vektor, paritas, visual 0 piksel, typecheck, lint, SAST | CI hijau |
| 5 | **Review & audit keamanan**: code review (`code-reviewer`, skill `ponytail-review`) + audit keamanan slice dengan skill `security-audit` Cloudflare (§6.3); semua temuan *Must fix* dan temuan keamanan `confirmed` diperbaiki lalu diverifikasi ulang | laporan review + `docs/slices/Sxx-keamanan.md` |
| 6 | **Staging & UAT**: deploy ke staging (snapshot produksi), smoke test, uji beban slice bila menyangkut publik. Tim menyiapkan skenario UAT lengkap (`docs/slices/Sxx-uat.md` dari `TEMPLATE-UAT.md`); **pemilik proyek** menjalankan UAT sendiri | skenario UAT berisi hasil & keputusan pemilik proyek |
| 7 | **Deploy produksi (gelap)**: image Next.js baru naik, rute **masih** ke Laravel; cek kesehatan & log | deploy sukses |
| 8 | **Pindah rute** di peta nginx → Next.js, **setelah pemilik proyek menyetujui** konfirmasi berbahasa sederhana (`TEMPLATE-PINDAH-RUTE.md`); pantau 3 hari kerja (error rate, p95, alert, laporan petugas) | persetujuan tertulis + 0 insiden P1/P2 |
| 9 | **Tutup slice**: tandai rute "milik Next.js" di checklist paritas, perbarui dokumentasi, catat backlog | slice selesai |

Rollback kapan pun di langkah 8: kembalikan baris peta rute, reload nginx, buka insiden, perbaiki, ulang dari
langkah 4.

Kode Laravel untuk fitur yang sudah pindah **tidak dihapus** sampai S17, supaya rollback selalu mungkin.

---

## 3. Urutan slice

Urutan dipilih dari risiko rendah ke tinggi, dan mengikuti ketergantungan: fitur yang dipakai fitur lain
dipindah lebih dulu.

| Slice | Fitur | Risiko | Minggu |
|---|---|---|---|
| **S0** | Platform & jembatan (belum ada fitur yang dipindah) | sedang | 3–4 |
| **S1** | Halaman statis publik | rendah | 0,5–1 |
| **S2** | Beranda, katalog, peta | rendah | 1–1,5 |
| **S3** | Lacak tiket & survei | sedang | 1–1,5 |
| **S4** | Formulir pengaduan (publik & internal) | tinggi | 1,5–2 |
| **S5** | Portal warga | sedang | 1 |
| **S6** | Admin tiket | tinggi | 2 |
| **S7** | Unit kerja, petugas, disposisi | sedang | 1–1,5 |
| **S8** | Matriks & rekap | sedang | 1,5–2 |
| **S9** | Master data & pengaturan | rendah | 1 |
| **S10** | Pengetahuan (artikel, sumber, dokumen) | sedang | 2 |
| **S11** | Rujukan & portal | sedang | 1,5 |
| **S12** | Mesin TARA (mode bayangan) | tinggi | 2–2,5 |
| **S13** | Contact center: chat warga & petugas + TARA aktif | **sangat tinggi** | 2,5–3 |
| **S14** | Akun dari chat & aktivasi | sedang | 1 |
| **S15** | Akun: masuk, daftar, lupa sandi, verifikasi email | tinggi | 1–1,5 |
| **S16** | Realtime: Reverb → Soketi | sedang | 0,5–1 |
| **S17** | Sisa API, pemadaman Laravel, bersih-bersih | rendah | 1 |
| | **Total** (satu developer + dukungan ops & pentest) | | **~25–31** |

Estimasi lebih panjang dari rencana cutover sekaligus (~15–22 minggu) karena tiap slice melewati staging, UAT,
deploy, dan masa pantau sendiri, ditambah jembatan S0. Sebagai gantinya, fitur pertama sudah di produksi sekitar
minggu ke-5 dan risiko tiap rilis jauh lebih kecil.

Pentest pihak ketiga dilakukan dua kali: setelah S4 (permukaan publik) dan sebelum S15 (auth).

---

## 4. Rincian slice

Setiap slice menyebut: cakupan, sumber Laravel, cron/job yang ikut pindah, test kunci, gerbang, dan catatan
rollback.

### S0 — Platform & jembatan

Tidak ada rute pengguna yang dipindah. Hasilnya: Next.js hidup di produksi di belakang nginx, siap menerima
rute.

| # | Pekerjaan |
|---|---|
| 0.1 | Persiapan dari rencana utama F0 (merge ke `main`, nilai produksi, snapshot staging, ekspor vektor, kerangka suite paritas & visual, baseline screenshot) |
| 0.2 | Scaffold `web/` sesuai §9.2, Drizzle (`drizzle-kit pull`), env Zod, log pino, OpenTelemetry |
| 0.3 | Kerangka desain §8: `app.css`, versi terkunci, skrip tema, layout publik/akun/admin. **Bukti: CSS identik & layout kosong 0 piksel beda** |
| 0.4 | `legacy/laravel-crypt.ts` (baca & tulis), NIK hash, bcrypt — lulus vektor kripto |
| 0.5 | **Jembatan sesi Laravel**: dekripsi cookie sesi Laravel (format `EncryptCookies` + prefix HMAC), baca baris `sessions`, unserialize payload PHP → user id, cek `password_hash_web`, perbarui `last_activity`. Tulis kunci tertentu (flash, `password_hash_web`) dengan serialize PHP. Diuji dengan sesi asli dari Laravel |
| 0.6 | **Jembatan Inertia**: request ber-header `X-Inertia` ke rute milik Next.js dijawab `409` + `X-Inertia-Location` sehingga browser memuat halaman penuh. Link dari Next.js ke Laravel adalah `<a>` biasa |
| 0.7 | **Jembatan realtime**: Next.js mengirim event ke Reverb lewat Pusher HTTP API (nama event & payload sama). `/broadcasting/auth` tetap di Laravel sampai S13 |
| 0.8 | **Jembatan cron**: Laravel membaca env `SCHEDULE_DIPINDAH=` dan melewati perintah yang sudah pindah; worker pg-boss menjalankan cron yang terdaftar di Next.js. Satu cron selalu tepat satu pemilik |
| 0.9 | nginx: `routes.map` (peta rute → upstream) + skrip `scripts/pindah-rute.sh <slice> next|laravel` dengan validasi `nginx -t` dan reload |
| 0.10 | Infrastruktur §9: Valkey, PgBouncer, role DB, object storage S3-compatible (Laravel juga dialihkan ke disk S3 yang sama), compose `web` + `worker`, health liveness/readiness |
| 0.11 | Rate limiter Valkey (9 limiter), reCAPTCHA, CSP ber-nonce, flash, peta error, outbox, idempotency key |
| 0.12 | CI/CD: lint, typecheck, unit, vektor, paritas, visual, SAST, build image bertag SHA, deploy staging otomatis, deploy produksi manual dengan backup & rollback |
| 0.13 | Observabilitas & alert §9.7 aktif untuk Next.js; dashboard per slice |
| 0.14 | Tim agent siap (`.claude/agents`, skill `ponytail` & `security-audit`); sandbox Docker untuk audit keamanan (§6.3); uji coba audit `quick` pada kode S0 |

**Gerbang S0:** halaman uji tersembunyi di Next.js (mis. `/_platform`) di produksi: membaca sesi admin & warga
yang login di Laravel, mengirim event ke Reverb yang diterima halaman Laravel, layout identik 0 piksel; rollback
peta rute diuji.

---

### S1 — Halaman statis publik

- **Rute:** `/panduan`, `/tentang`, `/tentang-kami`, `/pedoman-layanan`, `/syarat-ketentuan`, `/kebijakan-privasi`,
  redirect 301 lama (`/beranda-*`, `/katalog/kantor-balai`, `/lacak-tiket`, `/pengaduan`).
- **Sumber:** `PublicController` (guide, about, aboutUs, guidelines, terms, privacy), `static-shell`, `tara-shell`.
- **Test kunci:** visual 3 viewport × tema × status login (header berbeda saat login); redirect 301.
- **Gerbang:** 0 piksel beda; p95 < 300 ms.
- **Tujuan sebenarnya:** membuktikan seluruh jalur (build → staging → deploy → pindah rute → pantau → rollback)
  dengan fitur yang paling aman.

### S2 — Beranda, katalog, peta

- **Rute:** `/`, `/katalog`, `/peta`, `/api/v1/katalog/kanal`, `/api/v1/regions`.
- **Sumber:** `PublicController@home/catalog/map`, `StatsService::publicOverview` (cache 60 dtk → Valkey),
  `OfficialNews` (cache + tunda 10 menit), `PublicChannels` (`kanal_publik`), `kantor-direktori`, `province-map`,
  `program-5t`, `kanal-resmi`.
- **Test kunci:** angka statistik identik dengan Laravel di snapshot; berita resmi (fixture); peta (tile di-mask).
- **Gerbang:** 0 piksel; uji beban beranda sesuai §9.1.

### S3 — Lacak tiket & survei

- **Rute:** `/lacak`, `/lacak/{ticket}`, `/lacak/{ticket}/survei`, `POST /lacak/survei`, `POST /lacak-tiket/survei`,
  `/api/v1/tiket/{no}`, `/api/v1/survei/*`.
- **Sumber:** `TicketService::findForPublicLookup` (nomor baru & lama + `lookup_token` constant-time),
  `SurveyService`, `SurveyQuestionnaire`, `StoreSurveyRequest`.
- **Cron ikut pindah:** `sigap:pengingat-survei` (09:00) + surel `ReporterTicketMail` jenis pengingat.
- **Ditulis:** `surveys`, flag tinjau ulang di `tickets`, audit, notifikasi admin (in-app via Reverb + surel).
- **Test kunci:** vektor SKM; tiket internal/rahasia tidak bocor; rate limit `lookup` + `pengaduan`; reCAPTCHA
  `survei`; HTML surel identik.
- **Gerbang:** survei yang diisi lewat Next.js tampil benar di admin Laravel.

### S4 — Formulir pengaduan

- **Rute:** `/pengaduan/baru` (GET/POST), `/pengaduan/internal` (GET/POST), `POST /pengaduan` (lama),
  `/api/v1/pengaduan`, `/api/v1/pengaduan/internal`.
- **Sumber:** `PengaduanFormController`, `TicketService::create` (nomor `TKT-YYMMDD-XXXXXX` + retry, SLA,
  `lookup_token`, history pertama, provinsi, unit pelapor), `SlaCalculator`, `AttachmentService`, `NotificationService`,
  `ReporterNotifier`.
- **Ditulis:** `tickets` (NIK terenkripsi format Laravel), `ticket_histories`, berkas lampiran, outbox → broadcast
  `ticket.changed` + `notification.incoming` + surel.
- **Test kunci:** vektor SLA & nomor; idempotency (kirim dua kali = satu tiket); lampiran (MIME palsu ditolak);
  reCAPTCHA `pengaduan`/`pengaduan_internal`; rate limit; tiket muncul di admin Laravel lengkap dengan lampiran &
  notifikasi lonceng.
- **Gerbang:** uji beban 10× puncak pengajuan; **pentest pihak ketiga #1** (permukaan publik S1–S4).
- **Rollback:** tiket yang sudah dibuat Next.js tetap valid di Laravel.

### S5 — Portal warga

- **Rute:** `/portal-warga`, `PATCH /portal-warga/profil`, `/portal-warga/tiket/{no}/lampiran`,
  `DELETE /portal-warga/tiket/{no}`, `/api/v1/warga/*`.
- **Sumber:** `WargaPortalController`, `AccountService::updateProfile`, `EnsurePortalVerified`.
- **Catatan jembatan:** ganti sandi dari profil → hapus sesi lain + perbarui `password_hash_web` di sesi aktif
  (jembatan 0.5), supaya pengguna tidak ter-logout di halaman Laravel.
- **Test kunci:** warga hanya melihat tiket sendiri; hapus hanya status `baru`; IDOR lampiran.

### S6 — Admin tiket

- **Rute:** `/admin`, `/admin/tiket`, `/admin/tiket/{no}` (+ `lampiran`, `status`, `tanggapan`, `tinjau-ulang`),
  `/admin/tiket-internal`, `/admin/input-manual`, `/api/v1/admin/tickets*`, `/api/v1/admin/input-manual`,
  `/api/v1/admin/tiket-internal`.
- **Sumber:** `AdminController` (tickets, showTicket, updateStatus, reply, markReviewed, internal, inputManual),
  `TicketService::changeStatus` (lock, transisi, `responded_at`/`resolved_at`), `TicketFilters`, `Search`,
  `TicketPolicy`, `data-table`, `notification-bell`.
- **Cron ikut pindah:** `sigap:ews-check` (07:00).
- **Catatan:** layout admin di Next.js menampilkan lencana chat & rujukan dari DB; menu yang menuju halaman
  Laravel memakai `<a>` biasa.
- **Test kunci:** matriks transisi status; policy admin_kawasan vs super_admin; filter & pencarian (URL lama tetap
  berfungsi); indeks `pg_trgm` aktif; surel status ke pelapor.
- **Gerbang:** UAT oleh pemilik proyek dengan skenario alur kerja harian petugas (tiket masuk sampai selesai).

### S7 — Unit kerja, petugas, disposisi

- **Rute:** `/admin/unit-kerja*`, `/admin/petugas*`, `/admin/admins` (redirect & POST lama),
  `/admin/tiket/{no}/disposisi` (POST/DELETE), `/api/v1/admin/admins`.
- **Sumber:** `UnitController`, `AdminController` (admins, storeAdmin, email, unit), `DispositionService`.
- **Test kunci:** satu disposisi aktif per tiket (uji konkurensi); pohon unit; kebijakan sandi petugas.

### S8 — Matriks & rekap

- **Rute:** `/admin/matriks`, `/api/v1/admin/rekap`.
- **Sumber:** `MatrixService` (680 baris), `charts`, `province-map`, `funnel-chart`.
- **Test kunci:** skrip pembanding angka Laravel vs Next.js untuk ≥ 10 kombinasi filter di snapshot produksi —
  harus identik; `EXPLAIN ANALYZE` semua query; read replica bila p95 > target.
- **Gerbang:** angka identik + 0 piksel.

### S9 — Master data & pengaturan

- **Rute:** `/admin/kawasan*`, `/admin/kanal`, `/admin/integrasi/{channel}`, `/admin/kategori*`,
  `/admin/pengaturan*`, `/admin/profil`, `/admin/log-aktivitas`, `/api/v1/admin/{kawasan,kanal,pengaturan,integrasi}*`.
- **Sumber:** `AdminController`, `MasterController`, `IntegrasiController`, `PublicChannels`, `ChannelAdapterManager`
  (stub SP4N & WBS).
- **Cron ikut pindah:** `sigap:sync-channels` (06:00), prune `activity_logs`.

### S10 — Pengetahuan

- **Rute:** `/admin/pengetahuan*` (artikel, tinjau, dokumen, sumber), `/sumber/berkas/{source}`.
- **Sumber:** `KnowledgeController`, `KnowledgeDocumentController`, `KnowledgeSourceController`,
  `app/Modules/Knowledge/Ingestion/*`, `KnowledgeDocumentService` (usul artikel via AI).
- **Job & cron ikut pindah:** `ProcessKnowledgeDocument`, `SyncKnowledgeSource` (antrean `ingest`),
  `sigap:sinkron-sumber` (Senin 02:00).
- **Catatan:** cache indeks BM25 dibersihkan di Valkey **dan** cache Laravel setiap artikel/sumber berubah, karena
  TARA masih berjalan di Laravel sampai S13.
- **Test kunci:** SSRF (IP privat, redirect ke host luar allowlist); batas 20 MB; antivirus; selisih passage
  ekstraktor baru ditinjau.

### S11 — Rujukan & portal

- **Rute:** `/rujukan/{token}` (+ `buka`, `berhasil`, `bantuan`), `/admin/rujukan*`, `/admin/portal*`.
- **Sumber:** `app/Modules/Referral/*`, `ReferralController`, `ReferralPublicController`, `PortalController`.
- **Cron ikut pindah:** `sigap:pantau-rujukan`, `sigap:cek-portal`.
- **Catatan:** rujukan baru masih dibuat oleh TARA di Laravel sampai S13; format kode & token sama.

### S12 — Mesin TARA (mode bayangan)

Belum ada rute yang dipindah. Mesin TARA dibangun di Next.js dan dijalankan **berdampingan** tanpa menjawab warga.

- **Sumber:** `IndonesianText`, `KnowledgeRetriever`, `AiGateway` (breaker, token budget, batas per percakapan
  di Valkey; masking PII), prompt byte-identik, `Consultation`, `ResponsePolicy`, `ReplyComposer`, `NumberGuard`,
  `TicketLookup`, `TicketSuggester`.
- **Mode bayangan:** untuk setiap pesan warga baru, worker Next.js menghitung sumber & keputusan kebijakan dan
  membandingkannya dengan jawaban Laravel (tanpa memanggil model kedua kali bila tidak perlu). Selisih dicatat
  di dashboard.
- **Test kunci:** vektor stemmer, retrieval, policy (16 kasus), 31 golden reply; `uji-asisten` versi Next.js ≥ Laravel.
- **Gerbang:** 2 minggu mode bayangan dengan kecocokan sumber & keputusan ≥ 99%, selisih sisanya dijelaskan.

### S13 — Contact center + TARA aktif

Slice terbesar. Chat warga dan chat petugas dipindah **bersamaan** karena berbagi endpoint, event, dan status
percakapan.

- **Rute:** `/chat` + 13 endpoint `/chat/*`, `/admin/chat` + endpoint `ambil`, `tutup`, `balas`, `baca`,
  `belum-dibaca`, `rujuk`, `saran-tiket`, `konfirmasi-data`, `lampiran`; `/broadcasting/auth`.
- **Sumber:** `ChatController`, `ContactCenterController`, `ChatService`, `ChatAttachmentService`, `Handoff`,
  ServiceHours, `ContactCenterStats`, `live-chat-widget`.
- **Job & cron ikut pindah:** `RespondToMessage` (antrean `ai`), `sigap:ai-macet` (15 dtk), `sigap:uji-asisten`,
  prune percakapan tamu; halaman `/admin/kesehatan-ai`.
- **Catatan jembatan:** identitas tamu dibaca dari sesi Laravel & cookie lama `sigap_chat_tamu` (nama baru
  `cc_chat_tamu` baru dipakai di S17, lihat §10 rencana utama), sehingga percakapan
  yang sedang berlangsung tidak terputus saat rute dipindah.
- **Test kunci:** spec `live-chat`; unread atomik; tamu → login (adopsi percakapan); handoff di dalam & di luar jam
  layanan; AI mati → langsung petugas; uji 1.000 koneksi WebSocket; uji kegagalan worker `ai`.
- **Waktu pindah rute:** di luar jam layanan (Jumat sore setelah 16:00 atau akhir pekan), dengan petugas siaga
  saat jam layanan berikutnya.

### S14 — Akun dari chat & aktivasi

- **Rute:** `/admin/chat/{c}/akun`, `…/akun/pulihkan`, `…/akun/kirim-ulang`, `/aktivasi/{token}` (GET/POST),
  `POST /chat/lanjutkan`.
- **Sumber:** `StaffRegistrationService`, `AktivasiAkunController`, `AccountActivation`.
- **Catatan jembatan:** aktivasi menulis sesi login baru → dipindah setelah jembatan sesi terbukti stabil di
  S5–S13.

### S15 — Akun

- **Rute:** `/masuk`, `/keluar`, `/daftar`, `/lupa-sandi`, `/atur-ulang-sandi/*`, `/verifikasi-email*`,
  `/api/v1/auth/*`.
- **Sumber:** `MasukController`, `DaftarController`, `LupaSandiController`, `VerifikasiEmailController`,
  `AuthService`, `AccountService`, `EnsureRole`.
- **Pergantian pemilik sesi:** sejak slice ini Next.js yang membuat sesi. Selama sisa jendela rollback, Next.js
  tetap menulis sesi **dalam format Laravel** (jembatan 0.5) agar halaman Laravel yang belum dihapus dan rollback
  tetap berfungsi. Format sesi milik Next.js sendiri baru dipakai di S17.
- **Test kunci:** login NIK & username dengan akun produksi asli; dummy hash (waktu respons); throttle `login`
  & `akun`; link verifikasi bertanda tangan; reset sandi; akun nonaktif.
- **Gerbang:** **pentest pihak ketiga #2** (auth & seluruh aplikasi).

### S16 — Realtime: Reverb → Soketi

- Soketi ≥ 2 instance dengan adapter Valkey; kunci app sama sehingga klien cukup ganti host/port.
- Uji: semua channel & event, reconnect, 1.000 koneksi lewat Cloudflare Tunnel.
- Rollback: arahkan klien & publisher kembali ke Reverb.

### S17 — Penutupan

- Sisa `/api/v1` yang belum pindah; `/up`, `/sanctum/csrf-cookie` (bila masih perlu).
- Pindah ke format sesi Next.js sendiri (semua pengguna login ulang sekali, diumumkan).
- Hapus semua nama lama `sigap` yang tersisa (cookie, database, image, folder) sesuai §10 rencana utama.
- Jendela rollback terakhir 2 minggu → matikan container Laravel (`app`, `queue`, `queue-ai`, `scheduler`,
  `reverb`), hapus jembatan Inertia & cron, hapus folder `sigap/`.
- Drop tabel framework Laravel; tulis ulang `TECH-SPEC`, `DEPLOY`, `openapi.yaml`.
- Mulai backlog §9.9 (MFA admin, dll.).

---

## 5. Aturan selama masa transisi

- **Freeze fitur Laravel** tetap berlaku. Perbaikan bug pada fitur yang **belum** pindah dikerjakan di Laravel dan
  dicatat untuk slice terkait; pada fitur yang **sudah** pindah, dikerjakan di Next.js saja.
- Perubahan skema hanya **aditif** sampai S17.
- Satu cron, satu job, satu rute: selalu **tepat satu pemilik**. Peta rute & daftar `SCHEDULE_DIPINDAH` adalah
  sumber kebenarannya dan disimpan di repo.
- Pindah rute hanya di hari kerja pagi (kecuali S13), tidak menjelang libur panjang.
- Setiap slice punya dashboard: error rate, p95, jumlah request per rute (Laravel vs Next.js), alert.

---

## 6. Tim & alur kerja per slice

Setiap slice dikerjakan oleh tim subagent yang definisinya ada di `.claude/agents/`, dikoordinasi oleh sesi utama
(orkestrator). Semua yang menulis kode memakai skill **ponytail** (`.claude/skills/ponytail`); aturan proyek
selalu menang bila bertentangan.

### 6.1 Peran

| Peran | Agent | Tugas | Tidak boleh |
|---|---|---|---|
| Orkestrator | sesi utama | menulis `docs/slices/Sxx.md`, membagi kerja, menjalankan audit keamanan, meminta persetujuan pengguna, menutup slice | menyetujui langkah produksi atas nama pengguna |
| Senior programmer (1–2) | `senior-programmer` | membangun slice; dua orang bila slice bisa dibagi tanpa berbagi file (mis. domain/backend vs port halaman), masing-masing di worktree sendiri | mengubah test QA, menyentuh deploy |
| Code reviewer | `code-reviewer` | review independen dengan `ponytail-review` + checklist paritas/§8/§9/§10 | mengubah kode |
| DevOps / CI-CD | `devops-deployer` | CI, image, Compose, nginx & peta rute, deploy staging/produksi, rollback, observabilitas | langkah produksi tanpa persetujuan pengguna |
| QA | `qa-engineer` | test dulu (hijau di Laravel), verifikasi Next.js, visual 0 piksel, uji beban, smoke test | melemahkan test, uji beban/keamanan ke produksi |

### 6.2 Alur

| Langkah siklus (§2) | Siapa | Paralel? |
|---|---|---|
| 1 Spesifikasi | Orkestrator | — |
| 2 Test dulu | QA | bersamaan dengan persiapan CI oleh DevOps |
| 3 Bangun | Programmer 1 (+ Programmer 2) | dua programmer paralel di worktree terpisah |
| 4 Test hijau di Next.js | QA menjalankan, programmer memperbaiki | berulang sampai hijau |
| 5 Review & audit | Code reviewer **dan** audit `security-audit` | paralel; perbaikan oleh programmer, lalu review ulang bagian yang berubah |
| 6 Staging & UAT | DevOps deploy, QA smoke + beban; orkestrator & QA menyiapkan skenario UAT; **pemilik proyek** menjalankan UAT | — |
| 7 Deploy produksi gelap | DevOps, **setelah persetujuan pengguna** | — |
| 8 Pindah rute + pantau | Orkestrator mengirim konfirmasi berbahasa sederhana; setelah **pemilik proyek** setuju, DevOps memindah rute; QA smoke produksi | — |
| 9 Tutup | Orkestrator | — |

### 6.3 Audit keamanan per slice (skill `security-audit` Cloudflare)

- **Kapan**: setiap slice di langkah 5, sebelum staging. Ditambah satu audit penuh seluruh `web/` sebelum
  pentest pihak ketiga #1 (setelah S4) dan #2 (S15).
- **Mode**: *full audit mode*, **scoped run** — `scope_paths` = file slice (`web/src/app/<rute slice>`,
  `web/src/server/<domain slice>`, jembatan yang disentuh), atau diff `laravel-baseline..HEAD` untuk slice itu.
  Profil `standard`; `deep` untuk S4 (formulir publik), S13 (chat + AI), dan S15 (auth).
- **Dijalankan oleh** orkestrator, karena skill ini membagi kerja ke banyak subagent (recon, hunter, critic,
  verifier).
- **Keluaran** di luar repo: `~/security-audit-skill/contact-center/run-<N>/` (default skill). Ringkasan tanpa
  detail eksploit masuk ke `docs/slices/Sxx-keamanan.md`.
- **Sandbox**: skill hanya mengeksekusi kode target di sandbox OS (tanpa jaringan, env bersih, tulis terbatas).
  DevOps menyiapkan sandbox Docker (`--network none`, read-only, batas CPU/memori) di S0; tanpa itu temuan yang
  butuh eksekusi tercatat `needs_validation`.
- **Gerbang**: tidak ada temuan `confirmed` severity medium ke atas yang terbuka; temuan `low/informational`
  dicatat dengan keputusan; setiap `needs_validation` punya pemilik dan rencana validasi sebelum pindah rute.
- Audit tidak pernah menyentuh produksi atau layanan nyata (aturan skill), sejalan dengan aturan QA.

### 6.4 Skill & sumbernya

Semua skill disalin ke `.claude/skills/` setelah isinya dibaca (tanpa hook atau plugin), dengan commit sumber di
`SUMBER.md` tiap folder. Bintang GitHub per 13 Nov 2026.

| Skill | Sumber | ★ | Lisensi | Dipakai |
|---|---|---|---|---|
| `ponytail`, `ponytail-review` | DietrichGebert/ponytail | 190.182 | MIT | semua penulis kode; reviewer |
| `security-audit` | cloudflare/security-audit-skill | 71.664 | MIT | orkestrator, audit per slice |
| `vercel-react-best-practices` | vercel-labs/agent-skills | 34.001 | MIT (frontmatter) | programmer, reviewer |
| `next-bundle-optimizer`, `next-dev-loop`, `next-cache-components-adoption`, `next-cache-components-optimizer` | vercel/next.js `skills/` (dulu vercel-labs/next-skills, 991★) | 143.502 | MIT | programmer |
| `supabase-postgres-best-practices` | supabase/agent-skills | 3.050 | MIT | programmer, reviewer |
| `web-quality-audit`, `core-web-vitals`, `performance`, `accessibility`, `best-practices` | addyosmani/web-quality-skills | 3.080 | MIT | QA, devops |
| `differential-review` (+ agent `adversarial-modeler`), `semgrep`, `codeql`, `sarif-parsing`, `agentic-actions-auditor`, `supply-chain-risk-auditor` | trailofbits/skills | 8.170 | CC-BY-SA-4.0 | reviewer, devops |

Tidak dipasang: plugin hook/band/webhook ponytail; `vercel-optimize` & `deploy-to-vercel` (khusus hosting Vercel);
`next-partial-prefetching-*` (mengubah perilaku navigasi, bertentangan dengan §8); `seo` (mengubah `<head>`,
masuk backlog); `insecure-defaults` Trail of Bits (berbentuk command + workflow, bukan skill; cakupannya sudah
ditangani `security-audit`); `webapp-testing` Anthropic (Playwright Python, duplikat suite TS).

### 6.5 Saran skill vs paritas

Saran yang **tidak terlihat** pengguna boleh langsung dikerjakan. Saran yang **mengubah tampilan atau perilaku**
dicatat di `docs/backlog-pasca-cutover.md` dan dikerjakan setelah S17, supaya gerbang 0 piksel dan paritas
perilaku tetap berlaku.

### 6.6 UAT & persetujuan pindah rute

- **UAT** dijalankan sendiri oleh pemilik proyek di staging. Untuk tiap slice, orkestrator dan QA menyiapkan
  `docs/slices/Sxx-uat.md` dari `docs/slices/TEMPLATE-UAT.md`: akun uji per peran, data yang diisi, langkah demi
  langkah, hasil yang harus terlihat, dan pembanding di versi lama.
- Saat UAT, pemilik proyek bisa mencatat **beda dengan versi lama** (harus diperbaiki sebelum pindah rute) atau
  **permintaan tambahan**. Tambahan masuk `docs/backlog-pasca-cutover.md` kecuali pemilik proyek memutuskan
  sebaliknya — dengan konsekuensi gerbang paritas slice itu disesuaikan dan dicatat.
- **Pindah rute** hanya setelah pemilik proyek menjawab konfirmasi berbahasa sederhana
  (`docs/slices/TEMPLATE-PINDAH-RUTE.md`). Diam atau jawaban ragu = belum setuju.

## 7. Keputusan yang dibutuhkan

1. ~~Setuju strategi per fitur~~ — disetujui 13 Nov 2026.
2. ~~Lokasi hosting~~ — tetap di server produksi sekarang selama rewrite (13 Nov 2026); lihat rencana utama §9.10.
3. ~~UAT & persetujuan pindah rute~~ — keduanya oleh pemilik proyek (13 Nov 2026). Freeze mulai hari S0.
4. Hal terbuka lain di `docs/RENCANA-REWRITE-NEXTJS.md` §7.
