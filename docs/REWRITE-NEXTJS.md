# Persiapan Rewrite SIGAP ke Next.js

| Field | Nilai |
|---|---|
| Dokumen | Inventaris paritas & rencana persiapan |
| Tanggal | 12 Nov 2026 |
| Basis kode | `sigap-repo`, branch `feat/contact-center-ai` @ `f8713a0` (173 commit) |
| Mengacu | `docs/PRD.md`, `docs/PRD-AI.md`, `docs/TECH-SPEC.md`, `docs/PRD-UNIT-KERJA.md` |
| Status | Draf. Pilihan stack di §2 adalah **usulan**, belum keputusan |

Path di bawah relatif terhadap `sigap/` kecuali disebut lain.

---

## 0. Ringkasan

- **Ukuran yang dipindahkan:** ~27rb baris PHP (app, routes, config, database), ~28,5rb baris TS/TSX,
  42 halaman Inertia (18,8rb baris), 602 test PHPUnit, 52 test Vitest, 2 spec Playwright.
- **Frontend sebagian besar bisa dibawa.** React 19 + Tailwind 4 + Radix/shadcn + TanStack Table + Leaflet
  sudah sama dengan ekosistem Next.js. Yang harus diganti: `@inertiajs/react` (`useForm`, `router`, `usePage`,
  shared props), `@laravel/echo-react`, dan reCAPTCHA hook tetap. Ziggy tidak dipakai halaman mana pun.
- **Backend ditulis ulang total.** Bagian paling berisiko bukan CRUD, tapi logika yang hasilnya harus sama persis:
  BM25 + stemmer Indonesia (TARA), `ResponsePolicy`, `NumberGuard`, SLA, skor SKM, nomor tiket, dan
  **format enkripsi Laravel** untuk NIK/kontak yang sudah tersimpan di database produksi.
- **Database tetap.** Skema PostgreSQL 16 sekarang tidak memakai fitur khas Laravel (tanpa enum native, tanpa
  FTS/GIN, tanpa generated column). Next.js bisa langsung memakai database yang sama — tidak perlu migrasi data,
  asal kunci enkripsi dibawa.
- **Banyak sisa starter kit yang tidak perlu ikut** (lihat §8).

---

## 1. Fakta produksi yang wajib dibawa

Tanpa nilai-nilai ini data lama tidak terbaca atau perilaku berubah diam-diam.

| Item | Kenapa | Aksi persiapan |
|---|---|---|
| `APP_KEY` + `APP_PREVIOUS_KEYS` | Kunci AES-256-CBC untuk kolom terenkripsi (§4.1) | Salin ke env Next.js sebagai `LEGACY_APP_KEY(S)` |
| `NIK_HASH_KEY` | Blind index HMAC-SHA256 untuk login NIK dan pencarian NIK | Salin apa adanya (termasuk awalan `base64:` bila ada) |
| `APP_TIMEZONE` produksi | `.env.example` = `UTC`, padahal SLA menghitung hari kerja di zona waktu aplikasi | **Cek nilai di server.** Kolom `timestamp` tanpa zona waktu — tafsirannya harus sama |
| `SESSION_COOKIE`, `SANCTUM_STATEFUL_DOMAINS` | Nama cookie sesi tidak sama dengan yang ditulis di `openapi.yaml` | Cek di server; sesi lama boleh hangus saat cutover (semua pengguna login ulang) |
| `AI_*`, `RECAPTCHA_*`, `KNOWLEDGE_*`, `MAIL_*` | Konfigurasi integrasi | Salin; daftar lengkap kunci ada di `.env.example` |
| Volume `storage` | Lampiran tiket, lampiran chat, dokumen pengetahuan (disk privat) | Mount volume yang sama; path disimpan relatif (`lampiran/…`, `chat/{id}/…`, `knowledge/…`) |

---

## 2. Usulan stack target

> Belum ada keputusan "stack Next.js yang baru" di repo. Tabel ini usulan dengan alasan; ganti bila sudah ada
> standar tim.

| Lapisan | Sekarang | Usulan | Alasan |
|---|---|---|---|
| Framework | Laravel 12 + Inertia 2 | Next.js (App Router, versi stabil terbaru), TypeScript strict | Permintaan |
| ORM / query | Eloquent | **Drizzle** (`drizzle-kit pull` dari DB produksi) | Skema sudah ada; Drizzle dekat dengan SQL sehingga query agregat `MatrixService` (CASE/SUM, JSON path) mudah dipindah |
| Auth | Session DB + Sanctum (cookie) | Sesi sendiri di tabel PG (cookie httpOnly) atau Better Auth dengan credential provider kustom | Login memakai NIK *atau* username + bcrypt `$2y$` + invalidasi sesi saat ganti sandi — lebih sederhana ditulis sendiri daripada dipaksa ke library |
| Queue + scheduler | `database` queue, `schedule:work` | **pg-boss** (antrean & cron di Postgres) | Produksi sekarang tanpa Redis; pg-boss menjaga itu. Mendukung antrean terpisah `ai`, singleton per kunci, cron |
| Cache/rate limit/breaker | tabel `cache` | Tabel PG (atau Redis bila ditambahkan) | Circuit breaker, token budget, batas per percakapan, rate limiter harus bersama antar proses |
| Realtime | Reverb (protokol Pusher) | **Server berprotokol Pusher** (mis. Soketi) atau tetap Reverb sebagai container sementara | Frontend cukup ganti `@laravel/echo-react` ke `pusher-js`/`laravel-echo` biasa; channel & nama event tetap |
| Validasi | FormRequest | Zod (dibagi server & form) | |
| Form | Inertia `useForm` | Server Actions + `useActionState`, atau React Hook Form | 42 halaman memakai pola flash/redirect back |
| Email | Laravel Mail + Blade | React Email / template HTML + Nodemailer | 2 Mailable + 2 Notification |
| PDF/DOCX/HTML ingest | smalot/pdfparser, DOMDocument, ZipArchive | pdfjs-dist / unpdf, linkedom/cheerio, jszip | **Hasil teks akan beda** → hash isi berubah → semua sumber tersinkron ulang sekali (dapat diterima, lihat §5) |
| Gambar lampiran chat | GD (strip EXIF, rotasi, max 2000px) | sharp | |
| Test | PHPUnit, Vitest, Playwright | Vitest (unit/logic), Playwright (paritas) | |
| Deploy | Compose: app, queue, queue-ai, scheduler, reverb, web(nginx), db | Compose: `next` (standalone), `worker` (pg-boss, termasuk antrean `ai`), `realtime`, `db`, nginx/Cloudflare Tunnel tetap | Pola `scripts/deploy.sh` (tag SHA, rollback, backup) dipertahankan |

---

## 3. Inventaris permukaan HTTP

### 3.1 Rute web (semua harus ada, URL & nama Indonesia dipertahankan)

| Area | Jumlah rute | Catatan penting |
|---|---|---|
| Publik (beranda, panduan, katalog, peta, lacak, survei, pengaduan, statis) | ~25 + 9 redirect 301 lama | `/lacak/{ticket}` regex `[A-Za-z0-9-]{1,32}`; nomor lama `TKT-<n>` butuh `?kode=` (lookup_token) |
| Chat publik `/chat/*` | 14 | JSON endpoint; identitas tamu = sesi `chat_guest_token` + cookie terenkripsi 30 hari `sigap_chat_tamu` |
| Rujukan publik `/rujukan/{token}` | 4 | token 48 karakter |
| Aktivasi akun `/aktivasi/{token}` | 2 | token sha256, berlaku 72 jam |
| Akun (masuk, daftar, lupa/atur ulang sandi, verifikasi email, keluar) | 13 | Link verifikasi = URL bertanda tangan 60 menit |
| Admin `/admin/*` (admin_kawasan + super_admin) | ~70 | Otorisasi per aksi lewat policy (§3.4) |
| Admin khusus super_admin | ~15 | petugas, unit kerja, disposisi, log, kesehatan AI |
| Portal warga `/portal-warga/*` | 4 | Wajib email terverifikasi **atau** akun dibuat petugas (`registered_by`) |
| File | 5 | lampiran tiket (admin & warga), lampiran chat (warga & admin), berkas sumber publik, berkas dokumen |
| Implisit | `/up`, `/broadcasting/auth`, `/sanctum/csrf-cookie` | |

Tabel per rute (method, URI, nama, controller, middleware, halaman) ada di hasil inventaris; sumber
kebenarannya `routes/web.php`. Jalankan `php artisan route:list --json > docs/rewrite/routes.json` sebagai
daftar periksa sebelum mulai.

### 3.2 API `/api/v1`

28 endpoint (`routes/api.php`): health, auth (login/logout/session), pengaduan, tiket, survei, katalog,
warga, admin (tickets, rekap, kawasan, kanal, pengaturan, admins, integrasi).

- **Tidak ada endpoint yang menerbitkan Bearer token** (`createToken()` tidak dipanggil di mana pun).
  Sanctum hanya dipakai sebagai cookie SPA. Tanyakan: apakah ada klien eksternal yang memakai API ini?
  Jika tidak, API cukup dipertahankan untuk paritas atau dihapus.
- `docs/openapi.yaml` **tidak sesuai kode** di 8 titik (endpoint chat tidak ada, `role` hanya `admin|warga`,
  status 422 bukan 400, nama event, dsb.). Kode adalah acuan, bukan openapi.

### 3.3 Realtime

| Channel privat | Siapa boleh | Event (`broadcastAs`) |
|---|---|---|
| `chat.{conversationId}` | admin, atau pemilik percakapan (tamu tidak bisa → polling) | `chat.message` |
| `admin.chat` | admin | `chat.unread` `{conversation_id,total}` |
| `user.{id}` | diri sendiri | `ticket.changed`, `notification.incoming` |

Semua event dikirim **setelah commit**. Payload `chat.message` = `ChatService::present()`
(`app/Modules/ContactCenter/ChatService.php:359`) — bentuk ini dipakai langsung oleh `public/chat.tsx` dan
`admin/chat.tsx`, jadi harus identik.

### 3.4 Auth & otorisasi

- Peran: `warga`, `pegawai` (tidak punya area → 403), `admin_kawasan`, `super_admin`.
- Login satu kolom: 16 digit → NIK via `nik_hash`; selain itu → username. Ada dummy hash check agar waktu
  respons tidak membocorkan keberadaan akun. Akun nonaktif ditolak + audit.
- Ganti sandi → sesi lain & token dihapus (`AuthenticateSession`).
- Policy: `TicketPolicy` (viewAny/create/manageMaster = admin; view/update/reply = super, atau admin_kawasan
  untuk tiket non-internal; view juga untuk pelapor; viewInternal/manageAdmins = super), `UserPolicy`
  (updateRegion = super atau admin wilayah itu).
- `EnsureRole`: belum login → 401/redirect `/masuk`; nonaktif → audit + logout + 403; salah peran → redirect
  ke area sendiri.
- Rate limiter (`app/Providers/AppServiceProvider.php:41-86`): login, chat, chat-mulai, chat-baca, pengaduan,
  chat-lampiran, akun, lookup, health — angka per limiter harus sama. Request Inertia yang kena throttle
  dikembalikan sebagai error validasi (303), bukan halaman 429.
- reCAPTCHA v3 **fail closed** di produksi; aksi: `pengaduan`, `pengaduan_internal`, `survei`, `chat`,
  `daftar`, `lupa_sandi`.
- `SecurityHeaders`: CSP ber-nonce per request (Next.js mendukung nonce lewat middleware), XFO DENY, HSTS,
  izin host reCAPTCHA hanya bila site key diisi, tile OSM, gambar transmigrasi.go.id.

### 3.5 Shared props Inertia → layout/server context Next.js

`auth.user {id,name,username,role,is_admin}`, `chat_unread`, `chat_waiting`, `rujukan_perlu` (admin),
`recaptcha.site_key`, `assistant {enabled, service_hours}`, `flash {status,success,error}`, `app {brand,…}`.

---

## 4. Data

### 4.1 Kompatibilitas yang tidak boleh salah

**Kolom terenkripsi Laravel** — `users.nik`, `tickets.reporter_nik`, `chat_conversations.contact`,
`referrals.contact`, dan `chat_messages.meta.aktivasi.token` (di dalam JSON).

Format `Crypt::encryptString` (cast `encrypted`, tanpa serialisasi):
1. Nilai tersimpan = `base64(JSON {iv, value, mac, tag})`.
2. Kunci = `base64decode(APP_KEY tanpa "base64:")`, 32 byte.
3. `mac` = `hex(HMAC-SHA256(key, iv_b64 + value_b64))`; `tag` = `""`.
4. `value` = AES-256-CBC, PKCS7, base64.
5. Dekripsi: verifikasi mac → decrypt; coba kunci sekarang lalu tiap `APP_PREVIOUS_KEYS`.

Pilihan: (a) tulis encrypter TS yang kompatibel penuh (baca **dan** tulis format yang sama — direkomendasikan,
~60 baris, test dengan ciphertext asli dari PHP), atau (b) migrasi sekali ke format baru. (a) lebih aman karena
rollback ke Laravel tetap mungkin.

**NIK blind index** (`app/Support/Nik.php`): `trim()` → `hash_hmac('sha256', nik, key)` hex huruf kecil.
Kunci: bila diawali `base64:`, decode; selain itu string literal. Ditulis ulang setiap NIK berubah (hook
`saving` di `User` dan `Ticket`). Masking: 4 digit + `********` + 4 digit.

**Sandi**: bcrypt `$2y$` cost 12 — `bcrypt`/`bcryptjs` di Node menerima prefix `$2y$`.

**Token lain**: aktivasi = `sha256(Str::random(48))`; reset sandi memakai tabel `password_reset_tokens`
(Laravel menyimpan token ter-hash bcrypt) — boleh hangus saat cutover.

**Nomor**: tiket `TKT-YYMMDD-XXXXXX` (tanggal WIB, 6 karakter acak kriptografis dari
`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, retry 5× bila tabrakan); `lookup_token` 8 karakter alfabet sama,
dibandingkan constant-time; referensi chat `REF-YYMMDD-XXXX`; rujukan `RJK-YYMMDD-XXXX`.

### 4.2 Skema

25 tabel aplikasi + tabel framework (`sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`,
`failed_jobs`, `password_reset_tokens`, `personal_access_tokens`, `migrations`).

- Tidak ada enum native PG, CHECK, generated column, atau indeks FTS/trigram. Pencarian = `LOWER(col) LIKE`.
- Kolom `json` (bukan `jsonb`), `timestamp(0) without time zone`.
- Soft delete hanya di `tickets`.
- Aturan "maksimal satu disposisi aktif per tiket" hanya di service (pakai `SELECT … FOR UPDATE`), tidak di DB.
- Tabel framework Laravel dapat di-drop setelah cutover stabil; `sessions`/`jobs` diganti milik stack baru.

Langkah: `drizzle-kit pull` dari snapshot produksi → commit `schema.ts` → sejak cutover, Drizzle yang
memegang migrasi. Tabel `migrations` Laravel dibiarkan sebagai arsip.

### 4.3 Status sebagai konstanta (bukan enum DB)

| Domain | Nilai |
|---|---|
| Tiket status | baru, verifikasi, diproses, selesai, ditolak — transisi di `app/Enums/TicketStatus.php:41-50` |
| Prioritas / dampak / visibilitas | umum, prioritas, darurat / rendah, sedang, tinggi, kritis / publik, anonim, rahasia |
| Rujukan | dirujuk, dibuka, butuh_bantuan, berhasil, gagal |
| Disposisi | menunggu, diterima, dikembalikan, ditarik, selesai (diterima & dikembalikan belum pernah di-set kode) |
| Artikel / sumber / dokumen | draf, ditinjau, terbit / antre, diproses, siap, gagal / diproses, siap, gagal |
| Unit level | eselon_1, eselon_2, lainnya |
| Outcome percakapan | `ChatConversation.php:29-38` |

### 4.4 Seeder & data referensi

Master (4 kategori, 5 kanal, 4 setting), 27 unit kerja (Permentrans 11/2025), 9 + 33 artikel, 13 portal,
24 sumber resmi. 38 provinsi **bukan** di DB — konstanta di `app/Support/Provinces.php`, sudah ada
kembarannya di `resources/js/lib/provinces.ts`. Akun admin dibuat lewat `sigap:admin`, tidak di-seed.

Karena database dipakai ulang, seeder hanya perlu untuk dev/test; tulis ulang sebagai satu skrip `seed.ts`.

---

## 5. Logika yang harus identik (paling berisiko)

Untuk tiap butir: **ekspor vektor uji dari PHP dulu** (JSON input → output), lalu port sampai test TS lulus.

| Modul | File | Inti aturan |
|---|---|---|
| SLA | `app/Services/SlaCalculator.php`, `app/Enums/TicketImpact.php` | kritis 24j/3 hari kerja, tinggi 72j/7, sedang+rendah 120j/14; `min(dampak, kategori.sla_days)`; hanya lewati Sabtu–Minggu, tanpa libur nasional; status terpenuhi/berjalan/terlambat |
| Transisi tiket | `app/Services/TicketService.php:89` | lock baris; `responded_at` saat pertama keluar dari `baru`; `resolved_at` saat `selesai`, dihapus saat dibuka lagi; reset `ews_notified_at`; auto-assign aktor; tutup disposisi aktif |
| Disposisi | `app/Services/DispositionService.php` | satu aktif per tiket; pindah unit = tarik yang lama; `tickets.unit_id` cermin disposisi aktif |
| Survei SKM | `app/Support/SurveyQuestionnaire.php`, `SurveyService.php` | 9 aspek skala 1–4, indeks = `round(avg × 25, 2)`; mutu A ≥ 88,31, B ≥ 76,61, C ≥ 65; flag tinjau ulang |
| Kanal tiket | `app/Support/TicketIntake.php:67` | ekspresi SQL CASE `kanalSql()` — urutan cabang menentukan hasil |
| Rekap/matriks | `app/Services/MatrixService.php` (680 baris), `StatsService.php` | `sla_pct` null vs 100 berbeda antara dua service — pertahankan |
| Filter tiket | `app/Support/TicketFilters.php` | parameter query `status=aktif`, `petugas=none`, `periode=YYYY-MM|semua`, dst. (URL dipakai ulang di bookmark admin) |
| Retrieval TARA | `app/Modules/Knowledge/Retrieval/KnowledgeRetriever.php`, `IndonesianText.php` | BM25 k1=1,2 b=0,5; bobot judul ×3/×2; coverage ≥ 0,45; cutoff 0,35 × skor teratas; segmentasi pertanyaan panjang; **stemmer, stopword (termasuk Jawa/Sunda), sinonim harus disalin persis** |
| Kebijakan jawaban | `app/Modules/Assistant/ResponsePolicy.php` | fungsi murni, urutan 7 aturan; 16 unit test + 31 golden reply (`ReplyGoldenTest`) |
| NumberGuard | `app/Modules/Ai/NumberGuard.php` | setiap angka di jawaban harus ada di sumber atau pesan warga; normalisasi `1.300` → `1300` |
| AI gateway | `app/Modules/Ai/AiGateway.php` | breaker (5 gagal/120 dtk → buka 300 dtk), token budget harian WIB (notifikasi 80% & 100%), 20 panggilan/percakapan/jam, masking PII, retry sekali 300–800 ms, ekstrak JSON `{…}`, catat `ai_calls` tanpa isi prompt |
| Prompt | `app/Modules/Ai/Prompts/*.php`, `lang/id/asisten.php` | salin **byte-identik** termasuk `prompt_version`, agar hasil `sigap:uji-asisten` tetap sebanding |
| Handoff & jam layanan | `app/Modules/Assistant/Handoff.php`, ServiceHours | Senin–Jumat 08–16 WIB; di luar jam minta kontak |
| Async TARA | `app/Modules/Assistant/Jobs/RespondToMessage.php`, `ChatController.php:135-148` | unik per pesan, tidak tumpang tindih per percakapan, timeout 60 dtk → handoff `ai_gagal`; lewati bila ada pesan warga lebih baru atau petugas mengambil alih; `sigap:ai-macet` tiap 15 dtk menyerahkan yang macet > 90 dtk |
| Rujukan | `app/Modules/Referral/*` | penugasan ke petugas percakapan atau admin dengan rujukan terbuka paling sedikit; tindak lanjut 2 hari kerja; pengingat warga 20 jam; skor `PortalDirectory` ambang 2 |
| Unread chat | `app/Modules/ContactCenter/ChatService.php:47` | siapa menaikkan `unread_admin` vs `unread_user`; increment atomik |
| Ingest sumber | `app/Modules/Knowledge/Ingestion/*` | allowlist host + cek ulang tiap redirect (SSRF), batas 20 MB, crawl BFS ≤ 25 halaman, chunk ≤ 1200 karakter, buang < 25 karakter/< 8 kata, ganti passage hanya bila SHA-256 berubah |
| Lampiran | `AttachmentService.php`, `ChatAttachmentService.php` | ekstensi dari MIME terdeteksi; tiket jpg/png/pdf 5 MB; chat + webp, re-encode gambar |

Catatan: ekstraktor PDF/HTML Node akan menghasilkan teks sedikit berbeda dari smalot/DOMDocument. Konsekuensinya
passage dibuat ulang sekali setelah cutover dan skor retrieval bisa bergeser — ukur dengan
`sigap:uji-asisten` versi TS (fixture `database/data/uji-asisten.php`) sebelum dan sesudah.

---

## 6. Async & terjadwal

| Pekerjaan | Antrean / jadwal |
|---|---|
| `RespondToMessage` (jawaban TARA) | antrean `ai`, worker terpisah |
| `ProcessKnowledgeDocument` (300 dtk), `SyncKnowledgeSource` (900 dtk) | default |
| 4 broadcast event, 2 mail (`TicketNotificationMail`, `ReporterTicketMail`), 2 notifikasi (verifikasi, reset) | default, setelah commit |
| `sigap:sync-channels` | harian 06:00 (stub SP4N-LAPOR & WBS — tidak ada panggilan jaringan) |
| `sigap:ews-check` | harian 07:00 (setting `ews_enabled`) |
| `sigap:pengingat-survei` | harian 09:00 |
| `sigap:pantau-rujukan` | per jam, Senin–Jumat 08–17 |
| `sigap:cek-portal` | per jam |
| `sigap:ai-macet` | tiap 15 detik |
| `sigap:sinkron-sumber` | Senin 02:00 |
| `sigap:uji-asisten` | Senin 03:00 WIB, hanya bila model asli aktif |
| prune (`chat` tamu > 180 hari + filenya, `activity_logs` > 1 tahun, `ai_calls` > 90 hari) | harian 02:00 |

Perintah manual yang perlu padanan CLI: `sigap:admin`, `sigap:rehash-nik`, `sigap:reset-transaksi`,
`sigap:petakan-unit`, `sigap:koreksi-*`, `sigap:terbitkan-artikel-resmi`, `sigap:data-contoh`,
`sigap:e2e-setup`. Yang sekali-pakai (koreksi, petakan-unit) cukup dijalankan di Laravel sebelum cutover.

"Dispatch setelah commit" harus dijaga: di Node, kirim job/broadcast **setelah** transaksi selesai
(outbox sederhana atau pg-boss `send` di dalam transaksi yang sama).

---

## 7. Integrasi luar

| Tujuan | Untuk | Catatan |
|---|---|---|
| `{AI_BASE_URL}/chat/completions` | TARA, saran tiket, usul artikel | OpenAI-compatible saja; `response_format: json_object` dengan fallback bila 400; tanpa tool calling |
| Google reCAPTCHA siteverify | 6 aksi | skor min 0,5, action harus cocok |
| `www.transmigrasi.go.id/wp-json/wp/v2/posts` | berita beranda | cache "selamanya", segar 1 jam, tunda 10 menit setelah gagal |
| Host allowlist (`KNOWLEDGE_ALLOWED_HOSTS`) | ingest sumber | |
| URL portal | cek keterjangkauan per jam | status < 500 = terjangkau |
| SMTP | surel | |
| OSM tiles (browser) | peta | |

---

## 8. Yang tidak perlu ikut

- `routes/auth.php` — tidak pernah dimuat; controller-nya tidak ada.
- Layout & komponen starter kit: `app-layout`, `auth-layout`, `settings/layout`, `app/*`, `auth/*`,
  `user-menu-content`, `delete-user`.
- Ziggy (`config/ziggy.php`, `@routes`) — halaman memakai URL tertulis langsung.
- `resources/js/ssr.jsx` (SSR mati), `tests/Pest.php` (Pest tidak terpasang).
- Setting yang ditulis tapi tidak dibaca logika: `sla_response_minutes`, `auto_disposition`,
  `notification.pic_email/pic_phone` (`NotificationService::settings()` tanpa pemanggil). Putuskan: hapus atau
  akhirnya dipakai.
- Jalur Bearer token Sanctum (bila tidak ada klien eksternal).
- `docs/openapi.yaml` lama — tulis ulang dari kode baru.
- Isu `pending-security-hardening` yang khusus PHP (update Symfony, `php.ini`, hardening FPM) gugur setelah
  cutover; yang tetap relevan: CI belum jalan di branch deploy, konfigurasi nginx.

---

## 9. Strategi

> Rencana kerja rinci per fase: `docs/RENCANA-REWRITE-NEXTJS.md`.

**Rekomendasi: bangun paralel di database salinan, uji paritas, cutover sekaligus.**

Strangler (sebagian rute ke Next.js, sebagian tetap Laravel) kurang cocok di sini: sesi, identitas tamu chat,
dan CSRF Laravel tersimpan di cookie terenkripsi Laravel, sehingga dua aplikasi harus berbagi sesi. Biaya itu
lebih besar daripada manfaatnya untuk aplikasi seukuran ini. Pola cutover sekaligus juga sudah pernah dipakai
(app1 → app2).

Urutan kerja:

1. **Fondasi** — skema Drizzle hasil pull, encrypter Laravel + NIK hash + bcrypt (diuji dengan ciphertext asli),
   sesi & login, policy/role, rate limiter, CSP, layout admin & publik.
2. **Alur tiket** — formulir pengaduan (publik, internal, input manual), lacak, survei, admin tiket/detail/status/
   tanggapan/disposisi, portal warga, notifikasi & surel.
3. **Rekap** — matriks, kesehatan AI, log, master data (kawasan, kanal, kategori, unit, petugas, pengaturan).
4. **Contact center** — chat publik & admin, realtime, lampiran, akun dari chat, rujukan & portal.
5. **TARA & pengetahuan** — gateway AI, retrieval, policy, async worker, ingest, dokumen, uji-asisten.
6. **Paritas & cutover** — suite paritas hijau di Laravel dan Next.js, uji muat ringan chat, dry run cutover di
   staging dengan snapshot produksi, lalu cutover (maintenance singkat, sesi hangus, image Laravel disimpan
   untuk rollback — database tidak berubah sehingga rollback = ganti container).

---

## 10. Persiapan sebelum menulis kode Next.js

| # | Tugas | Hasil |
|---|---|---|
| P1 | Tetapkan stack final (§2) | keputusan tertulis di dokumen ini |
| P2 | Bekukan fitur baru di Laravel, atau sepakati bahwa fitur baru ditulis di dua tempat | tanggal freeze |
| P3 | Gabungkan `feat/contact-center-ai` (yang jalan di produksi) ke `main`; jadikan `main` basis rewrite | satu sumber kebenaran |
| P4 | Catat nilai produksi di §1 (terutama `APP_TIMEZONE`) | tabel terisi |
| P5 | Snapshot DB produksi (anonim bila perlu) untuk staging rewrite | dump + skrip restore |
| P6 | Ekspor vektor uji dari PHP: SLA, SKM, nomor tiket, stemmer + BM25 (pertanyaan → passage id), ResponsePolicy, NumberGuard, PiiMasker, `kanalSql`, ciphertext contoh | `docs/rewrite/fixtures/*.json` + artisan command pengekspor |
| P7 | Ubah test HTTP black-box (`tests/Feature/Web`, `Api`, `Fixes`, `Infra/RateLimit`) menjadi suite Playwright/HTTP yang tidak bergantung pada Laravel; jalankan hijau dulu terhadap Laravel | suite paritas |
| P8 | `php artisan route:list --json` + daftar halaman & props per halaman (~150 `assertInertia` memberi bentuk props) | checklist paritas |
| P9 | Tangkapan layar semua halaman (sudah ada `tests/panduan/tangkapan.spec.ts`) sebagai acuan visual | folder screenshot |
| P10 | Putuskan nasib API `/api/v1` dan butir §8 | daftar hapus/pertahankan |

---

## 11. Pertanyaan terbuka

1. "Stack Next.js yang baru" — sudah ada standar (ORM, auth, hosting, monorepo) yang harus diikuti?
2. Tetap self-host Docker di `srvr-dev-andy` atau pindah (Vercel tidak cocok untuk worker, WebSocket, dan
   volume lampiran)?
3. Ada klien eksternal untuk `/api/v1`?
4. Boleh menambah Redis, atau tetap tanpa Redis?
5. Libur nasional untuk SLA — tetap tidak dihitung, atau sekalian ditambahkan saat rewrite (mengubah paritas)?
6. Kanal SP4N-LAPOR & WBS masih stub — ikut dipindah sebagai stub atau ditunda?
