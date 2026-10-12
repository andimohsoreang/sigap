# PRD — SIGAP (Sistem Pengelolaan Pengaduan Masyarakat)
## Migrasi ke Stack: Laravel · React · Tailwind CSS · shadcn/ui

| Field | Nilai |
|---|---|
| Nama Produk | SIGAP — *Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas* |
| Pemilik Produk | Kementerian Transmigrasi Republik Indonesia |
| Domain saat ini | `app1.andimohamad.my.id` |
| Versi Dokumen | 1.0 (draft) |
| Tanggal | 05 Okt 2026 |
| Status | Draft untuk persetujuan |

> **Prinsip utama proyek ini:** **pertahankan tampilan (UI/UX) dan data yang sudah ada**, hanya ganti fondasi teknologi. Migrasi bersifat *in-place behavior-preserving*: pengguna tidak boleh merasa ada perubahan selain yang memang diperbaiki (bug/keamanan).

---

## 1. Latar Belakang

Saat ini SIGAP adalah **SPA statis satu file** (`index.html` ~323 KB) yang di-serve nginx, dengan backend terpisah berupa service Node.js bernama `sigap-api`. Hasil audit (05 Okt 2026) menemukan:

- Frontend memuat **blok "MODE DEMO"** dengan kredensial plaintext (`admin/admin123`, `warga123`) yang **valid di produksi**.
- **~70% panel admin kosong** — puluhan endpoint yang dipanggil UI mengembalikan 404 dan ditutupi **data dummy hardcoded** di HTML.
- **Bug logika bisnis**: `tingkatDampak` diabaikan (semua tiket jadi prioritas "Sedang"), SLA tidak mengikuti klasifikasi dampak, `sla_pct` selalu 0, field `kawasan`/`koordinat`/`lampiran` tidak tersimpan.
- **Kebocoran**: tiket internal dapat dibaca publik berikut identitas pegawai.
- **Keamanan**: cookie tanpa `Secure`, tanpa security header/CSP, stored XSS tidak disanitasi, kredensial default.

Tujuan proyek: membangun ulang pada stack modern yang **terkelola, aman, dan dapat dilanjutkan**, tanpa mengubah pengalaman pengguna.

---

## 2. Tujuan & Sasaran (Goals)

### 2.1 Tujuan
1. **Pertahankan 100% tampilan** — struktur halaman, navigasi, warna, tipografi, ikon, dark mode, i18n ID/EN, aksesibilitas.
2. **Pertahankan/migrasikan data** — tiket, akun, kawasan, kanal, konfigurasi tetap ada dan konsisten.
3. **Lengkapi proses bisnis** — endpoint backend yang kini dummy menjadi fungsional.
4. **Tutup semua temuan keamanan** audit.
5. **Bangun fondasi komponen** dengan **shadcn/ui** agar konsisten dan reusable.

### 2.2 Non-Goals (fase ini)
- Redesain visual total (hanya diperbolehkan memperbaiki inkonsistensi kecil).
- Integrasi nyata SP4N-LAPOR!/WBS (tetap disiapkan sebagai adapter/stub terstruktur).
- Aplikasi mobile native.
- Multi-tenant di luar Kementerian Transmigrasi.

### 2.3 Metrik Keberhasilan
| Metrik | Target |
|---|---|
| Paritas visual | ≥ 98% halaman identik saat dibandingkan side-by-side |
| Cakupan endpoint | 100% endpoint yang dipanggil UI tersedia (tidak ada 404) |
| Regresi data | 0 baris data hilang saat migrasi |
| Skor keamanan | Semua temuan audit 🔴/🟠 tertutup |
| Waktu muat (LCP) | < 2.5s pada 4G |
| Coverage test backend | ≥ 80% pada modul inti (auth, tiket, SLA) |

---

## 3. Persona & Peran

| Peran | Deskripsi | Akses |
|---|---|---|
| **Warga (Publik)** | Masyarakat / pelapor, boleh anonim | Buat aduan, lacak tiket, lihat data terbuka, survei |
| **Warga (Terdaftar)** | Pemilik akun | Semua di atas + portal warga (profil & riwayat tiket sendiri) |
| **Pegawai Internal** | ASN Kementerian | Form pengaduan internal (sarana & TIK) |
| **Admin Kawasan** | Petugas per satuan permukiman | Kelola tiket wilayahnya |
| **Super Admin** | Pusat / Biro Humas | Semua modul, integrasi kanal, daftar admin, pengaturan |

---

## 4. Arsitektur Target

### 4.1 Stack
| Layer | Teknologi | Peran |
|---|---|---|
| Backend | **Laravel 11+ (PHP 8.3)** | REST API, auth, RBAC, validasi, policy, queue, storage |
| Database | **PostgreSQL 16** | Data relasional |
| Frontend | **React 18 + Vite + TypeScript** | SPA |
| Jembatan FE/BE | **Inertia.js** (+ opsional `fetch` ke `/api/v1`) | Satu repo, tanpa CORS |
| Styling | **Tailwind CSS v3** | Konfigurasi **dipertahankan dari `tailwind.config.js` saat ini** |
| Komponen | **shadcn/ui** (Radix UI + CVA + tailwind-merge) | Komponen reusable, aksesibel, themeable |
| Routing FE | React Router v6 | Paritas 14 halaman saat ini |
| Data fetching | TanStack Query | Cache, retry, sinkronisasi state server |
| Form | React Hook Form + Zod | Validasi sisi klien selaras aturan Laravel |
| State | Zustand (ringan) | UI state (tema, bahasa, sesi tampilan) |
| Ikon | Lucide (dipakai shadcn) **+ FontAwesome 6** | Lucide untuk komponen baru; FontAwesome dipertahankan agar ikon lama identik |
| Export | SheetJS (SheetJS tetap) | Ekspor Excel seperti sekarang |
| Auth | Laravel Sanctum (cookie-based, SPA) | Sesi httpOnly + CSRF |
| Real-time | **Laravel Reverb** (WebSocket) | Live chat & notifikasi real-time |
| Peta | **Leaflet** + OpenStreetMap tiles | Peta kawasan |
| Integrasi | **Stub adapter** (SP4N/WBS/WBS) | Kontrak jelas, implementasi nyata menyusul |
| Deploy | **Docker Compose** (nginx + PHP-FPM + Reverb + queue + scheduler + PostgreSQL); Cloudflare Tunnel | Seragam dengan stack lain di server; lihat `docs/PRD-DEPLOY.md` |

### 4.2 Keputusan Arsitektur (Terkunci)

| # | Topik | Keputusan | Konsekuensi |
|---|---|---|---|
| D1 | Integrasi FE/BE | **Satu repo Laravel**, React di-embedful, **didukung lapisan API yang dapat dikeluarkan kapan pun diminta** | Lihat §4.3 |
| D2 | Database | **PostgreSQL 16** | Gunakan tipe `jsonb`, `timestamptz`, `uuid` opsional, full-text search |
| D3 | Auth Warga | **NIK + Password** | Tidak ada OTP; wajib rate-limit & hashing kuat |
| D4 | Lampiran | **Disk lokal** (`storage/app/private`) | Disajikan lewat controller ter-otorisasi, bukan URL publik langsung |
| D5 | Real-time | **Laravel Reverb** saja | Chat & notifikasi via WebSocket; tidak pakai polling |
| D6 | Peta | **Leaflet** | Tiles OSM; marker kawasan dari API |
| D7 | Integrasi SP4N/WBS | **Stub adapter** dulu | Interface + fake driver, mudah ditukar ke HTTP driver nanti |
| D8 | Lingkungan | **Docker Compose**, stack baru `app2-sigap` di `app2.andimohamad.my.id`; staging opsional `staging-app2.andimohamad.my.id` | `app1.andimohamad.my.id` (sistem lama) dialihkan ke stack baru saat cutover |
| D9 | Data spasial kawasan | **Dummy dahulu** (koordinat contoh) | Struktur data nyata, isi placeholder; ganti saat shapefile tersedia |
| D10 | Gateway WhatsApp | **Tidak dipakai dulu** | Notifikasi hanya email/in-app; adapter WA disiapkan tapi disabled |

### 4.3 Model Aplikasi: Laravel + Inertia + Lapisan API Siap-Pakai (D1)

Satu repo Laravel yang menyajikan React via **Inertia.js**, namun logika bisnis dipisah tegas sehingga **data dapat dikeluarkan sebagai REST API kapan pun diminta** tanpa refactor besar:

```
app/
  Http/
    Controllers/
      Web/        <-- controller Inertia (render halaman React)
      Api/V1/     <-- controller JSON (REST API siap pakai)
    Requests/     <-- FormRequest dipakai BERSAMA oleh Web & Api
    Resources/V1/ <-- API Resource (bentuk JSON konsisten)
  Services/       <-- logika bisnis murni (dipakai Web & Api)
  Policies/       <-- otorisasi bersama
routes/
  web.php         <-- route Inertia
  api.php         <-- route /api/v1/* (dapat diaktifkan/dimatikan)
```

**Aturan emas:** controller Web & Api **tidak boleh berisi logika bisnis**. Keduanya memanggil `Service` yang sama dan memakai `FormRequest` + `Resource` yang sama. Dengan begitu:
- Hari ini: React memakai Inertia (satu origin, sesi cookie, tanpa CORS).
- Nanti jika diminta API: cukup aktifkan `routes/api.php` — endpoint `/api/v1/*` langsung hidup, konsumen mobile/pihak ketiga bisa memakai token Sanctum.

**Konsekuensi:** frontend memakai Inertia `<Link>`/`router` untuk navigasi antar halaman, tetapi data tabel/form tetap boleh mengambil `fetch` ke `/api/v1/*` (mis. live update chat, polling statistik) sehingga kedua jalur hidup berdampingan.

### 4.4 Batasan Arsitektur
- **Keputusan UI-preservation**: komponen shadcn/ui akan **di-theme** memakai token warna SIGAP di `components.json` + CSS variables, sehingga hasil render mendekati Tailwind config lama:
  - `primary #0E5B72`, `primaryLight #0093B6`, `primarySoft #E5F4F7`, `secondary #C3A167`, `darkBg #0f172a`, `darkCard #1e293b`, `light #F3F4F6`
  - Font: **Inter** (300–800)
  - `darkMode: 'class'`

---

## 5. Information Architecture (Paritas Halaman)

### 5.1 Halaman Publik (14 route — dipertahankan persis)
| ID lama | Route baru | Deskripsi |
|---|---|---|
| `beranda` | `/` | Beranda, hero, kanal resmi, FAQ, maklumat |
| `katalog` | `/katalog` | Katalog kanal pengaduan |
| `formulir-pengaduan` | `/pengaduan/baru` | Formulir SIGAP (publik) |
| `formulir-internal` | `/pengaduan/internal` | Pengaduan internal pegawai |
| `lacak-tiket` | `/lacak` + `/lacak/:nomor` | Pelacakan tiket |
| `peta` | `/peta` | Peta kawasan |
| `masuk` | `/masuk` | Login gabungan (warga/admin) |
| `portal-warga` | `/portal-warga` | Dashboard warga (profil & riwayat) |
| `pedoman-layanan` | `/pedoman-layanan` | SOP & SLA |
| `syarat-ketentuan` | `/syarat-ketentuan` | S&K |
| `kebijakan-privasi` | `/kebijakan-privasi` | Kebijakan privasi |
| `tentang-kami` | `/tentang-kami` | Tentang kami |
| `tentang` | bagian dari `/tentang-kami` | Data terbuka (harian/bulanan/hukum/agen) |
| `admin` | `/admin/*` | Panel admin (guarded) |

### 5.2 Panel Admin (9 sub-halaman)
`admin-dashboard` (Matriks Rekapan), `admin-tiket`, `admin-tiket-internal`, `admin-input-manual`, `admin-chat` (Pesan Masuk), `admin-petugas` (Daftar Admin), `admin-kawasan`, `admin-kanal`, `admin-pengaturan`.

---

## 6. Model Data (Target)

```mermaid
erDiagram
  users ||--o{ tickets : "melaporkan"
  users ||--o{ survey : "menilai"
  users }o--|| regions : "wilayah tugas (admin)"
  tickets ||--o{ ticket_histories : "riwayat"
  tickets ||--o{ ticket_replies : "tanggapan"
  tickets ||--o| survey : "punya"
  tickets }o--|| categories : "kategori"
  tickets }o--|| regions : "kawasan"
  tickets }o--|| channels : "kanal"
  tickets }o--|| users : "petugas"

  users { bigint id; string nik "16 digit, unique"; string username; string name; string email; string phone; string role; string password_hash; bigint region_id; boolean is_active; timestamps }
  tickets { bigint id; string ticket_no "TKT-n"; string title; text description; string status "baru|verifikasi|diproses|selesai|ditolak"; string priority; string impact "rendah|sedang|tinggi|kritis"; string visibility "publik|anonim|rahasia"; string coordinates; string attachment_path; boolean is_internal; bigint category_id; bigint region_id; bigint channel_id; bigint assignee_id; bigint reporter_id; timestamp sla_due_at; timestamp responded_at; timestamp resolved_at; timestamps }
  ticket_histories { bigint id; bigint ticket_id; string from_status; string to_status; bigint actor_id; text note; timestamp }
  ticket_replies { bigint id; bigint ticket_id; bigint author_id; text body; boolean is_public; timestamps }
  survey { bigint id; bigint ticket_id; tinyint rating; text comment; timestamps }
  categories { bigint id; string name; string priority_default; int sla_days }
  regions { bigint id; string code; string name; string province; string coordinates; string infrastructure_status; int kk_count }
  channels { bigint id; string type "sosmed|kantor|nasional"; string name; string url; string status; json config }
  settings { bigint id; string key; json value }
```

### 6.1 Aturan SLA (perbaiki bug B1/B2)
Pemetaan **dampak → prioritas → SLA** sesuai Pedoman Layanan:
| Dampak | Prioritas | Respon Awal | Penyelesaian |
|---|---|---|---|
| Kritis | Darurat | 1×24 jam | 3 hari kerja |
| Tinggi | Prioritas | 3×24 jam | 7 hari kerja |
| Sedang / Rendah | Umum | 5 hari kerja | 14 hari kerja |

`tingkatDampak` dari form **wajib** memetakan ke `priority` dan `sla_due_at`. Ini memperbaiki B1 & B2. Kategori boleh memodifikasi `sla_days` (lihat `categories.sla_days`) sebagai faktor tambahan, bukan pengganti.

### 6.2 Aturan Privasi/Visibilitas
- `publik/anonim` → identitas disembunyikan otomatis, progres terbuka.
- `rahasia` → hanya Agen Verifikator pemegang kasus.
- `is_internal = true` → **tidak boleh muncul di endpoint lacak publik** (perbaiki B4).

---

## 7. Kontrak API (Laravel)

Semua endpoint di bawah **wajib ada** (menghilangkan 404 yang ditutupi dummy). Format respons dipertahankan semirip mungkin dengan yang sudah dikonsumsi frontend saat ini.

### 7.1 Auth (publik)
| Method | Endpoint | Isi | Catatan |
|---|---|---|---|
| POST | `/api/auth/login` | `{identifier, password}` → `{role, nama, id}` + cookie | Satu pintu, role ditentukan server; rate limit + throttle |
| POST | `/api/auth/logout` | cabut sesi | |
| GET | `/api/auth/session` | `{authenticated, role, nama}` | |

### 7.2 Publik
| Method | Endpoint | Isi |
|---|---|---|
| POST | `/api/pengaduan` | Buat tiket → `{ok, nomor_tiket, id}`; validasi NIK 16 digit, uraian ≥10 |
| POST | `/api/pengaduan/internal` | Tiket internal pegawai |
| GET | `/api/tiket/{nomor}` | Lacak; NIK ter-mask; `is_internal` dikecualikan |
| POST | `/api/survei/{nomor}` | Simpan rating + komentar |
| GET | `/api/katalog/kanal` | Daftar kanal publik |

### 7.3 Warga (auth: warga)
`GET /api/warga/session`, `GET /api/warga/profile`, `PATCH /api/warga/profile`, `GET /api/warga/tickets`, `POST /api/warga/logout`.

### 7.4 Admin (auth: admin/super_admin)
| Method | Endpoint | Isi |
|---|---|---|
| GET | `/api/admin/tickets` | Daftar + filter `status`, `region`, `category`, `impact`, `q`, pagination |
| GET | `/api/admin/tickets/{nomor}` | Detail + riwayat + tanggapan |
| POST | `/api/admin/tickets/{nomor}/status` | Ubah status (enum tervalidasi) + catatan |
| POST | `/api/admin/tickets/{nomor}/tanggapan` | Balasan admin (**baru**, sekarang 404) |
| POST | `/api/admin/input-manual` | Tiket dari kanal offline/medsos |
| GET | `/api/admin/tiket-internal` | Daftar tiket internal (**baru**) |
| GET/POST | `/api/admin/kawasan` | Direktori kawasan (**baru**) |
| GET/POST | `/api/admin/kanal` | Manajemen kanal (**baru**) |
| GET/POST | `/api/admin/admins` | Daftar admin (**baru**) |
| GET | `/api/admin/rekap` | Statistik `{total, byStatus, ews, sla_pct}` — **perbaiki sla_pct** |
| GET/PUT | `/api/admin/pengaturan` | SLA, notifikasi, kategori (**baru**) |
| GET/POST | `/api/admin/chat` | Pesan masuk (**baru**) |
| POST | `/api/admin/integrasi/{sp4n\|wbs}` | Konfigurasi & sinkron (stub adapter) |

### 7.5 Prinsip Kontrak
- Gunakan **API Resource** Laravel untuk membentuk payload.
- **Pagination**: Laravel default; mapping ke `Menampilkan X-Y dari Z` di UI.
- Validasi → 422 dengan pesan Bahasa Indonesia (samakan dengan yang ada, mis. `"NIK harus 16 digit angka."`).
- Status code: 401 unauthenticated, 403 forbidden, 404 not found, 429 throttled (samakan pesan `"Terlalu banyak percobaan login. Coba 1 menit lagi."`).

---

## 8. Functional Requirements per Modul

### FR-01 Autentikasi & RBAC
- Satu form login untuk warga (NIK) & petugas (username).
- Role dari server → arahkan ke `/portal-warga` atau `/admin`.
- **Wajib**: password di-hash (bcrypt/argon2), tidak ada kredensial default yang ditampilkan/di-hardcode, rate limit login.
- **D3 — NIK + Password saja**: tidak ada OTP. Wajib: (a) validasi NIK 16 digit, (b) hashing Argon2id, (c) throttle per-NIK + per-IP, (d) notifikasi login mencurigakan (opsional).
- Policy: warga hanya akses data miliknya; admin kawasan hanya wilayahnya; super admin semua.

### FR-02 Pengaduan Publik
- Field persis seperti sekarang: NIK, nama, email, telepon, judul, uraian, **titik koordinat GPS** (geolocation), **lokasi kawasan** (SP1 Merauke/SP3 Bulungan/SP2 Luwu Timur — kini **benar tersimpan**), kategori, tingkat dampak, anonim/rahasia, lampiran (maks 5MB), reCAPTCHA, notifikasi WA.
- Perbaiki: `kawasan`, `koordinat`, `lampiran`, `kontak`, `tingkatDampak→priority/SLA` tersimpan (B6/B7).
- Rate limit + verifikasi captcha di server.

### FR-03 Pengaduan Internal Pegawai
- Field: NIP, nama, unit, kontak, kategori gangguan, urgensi, lokasi, deskripsi, lampiran.
- Tiket internal **terpisah** dari publik; notifikasi ke PIC **via email/in-app saja** (WA dinonaktifkan — D10).

### FR-04 Pelacakan Tiket
- Input nomor `TKT-xxxx` (validasi format).
- Tampilkan status, judul, riwayat, tanggapan, SLA.
- **Tidak** menampilkan tiket internal.

### FR-05 Portal Warga
- Profil (nama, NIK ter-mask, email, telepon), ubah email/telp/password.
- Riwayat tiket + lihat detail.

### FR-06 Panel Admin
- **Matriks Rekapan**: tabel tiket + filter (wilayah, kategori, dampak, status, tanggal), statistik (total, EWS, SLA%), cetak PDF, ekspor Excel.
- **Manajemen Tiket**: daftar, detail, ubah status, tanggapan, audit trail.
- **Tiket Internal**: daftar + statistik (hari ini, bulan ini, top kategori, rata-rata penyelesaian).
- **Input Manual**: terbitkan tiket dari offline/medsos.
- **Pesan Masuk**: live chat admin **real-time via Laravel Reverb** (D5) — pesan, indikator mengetik, status online, badge belum dibaca.
- **Daftar Admin**: CRUD admin + wilayah + role.
- **Data Kawasan**: CRUD kawasan transmigrasi.
- **Manajemen Kanal**: CRUD medsos & kantor; integrasi SP4N/WBS (**stub adapter**, D7).
- **Pengaturan**: profil admin, SLA & EWS, kategori, notifikasi internal.

### FR-07 Data Terbuka & Peta
- Matriks laporan harian/bulanan, landasan hukum, tentang agen.
- **Peta kawasan memakai Leaflet** (D6): tiles OpenStreetMap, marker per kawasan dari API, popup info, filter wilayah; paritas bubble angka di tampilan lama.
- **Data spasial dummy dahulu** (D9): endpoint `/api/v1/regions` mengembalikan koordinat contoh berformat benar, siap diganti data nyata/geometri tanpa mengubah FE.

### FR-08 UX Global (paritas penuh)
- **Dark mode** (class-based), **high contrast**, **pengaturan ukuran font**.
- **i18n ID/EN** (48 atribut `data-i18n` saat ini).
- **Live chat widget real-time (Reverb)**, menggantikan balasan `setTimeout` palsu.
- **Modal/alert kustom** (bukan `window.alert`), **lightbox** gambar bukti.
- **Notifikasi toast real-time** (EWS alert, tiket selesai) via Reverb.
- Navigasi route, tombol kembali.

### FR-09 Integrasi Kanal (Stub Adapter — D7)
- Interface `PengaduanChannelAdapter` dengan method `sync(): ChannelSyncResult` dan `pullAggregate(): array`.
- Driver stub `Sp4nLaporStubAdapter` & `WbsStubAdapter` yang mengembalikan data contoh terstruktur; log sinkronisasi tetap dicatat.
- Menukar ke integrasi nyata cukup mengganti driver (binding di service provider), tanpa mengubah controller/UI.

---

## 9. Design System & Komponen (shadcn/ui)

### 9.1 Theming
- `components.json` + CSS variables memetakan token SIGAP:
  - `--primary: 0E5B72`, `--primary-light: 0093B6`, `--primary-soft: E5F4F7`, `--secondary: C3A167`, dst.
- shadcn/ui dipakai untuk: `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `Dialog`, `AlertDialog`, `Sheet`, `Tabs`, `Table`, `Badge`, `Card`, `DropdownMenu`, `Toast` (Sonner), `Calendar`, `Popover`, `Tooltip`, `Avatar`, `Skeleton`, `Pagination`.

### 9.2 Mapping komponen lama → shadcn/ui
| Komponen lama | Pengganti shadcn/ui | Catatan paritas |
|---|---|---|
| Tombol `bg-primary hover:bg-primaryLight` | `Button` varian default | Samakan radius & warna |
| Select wilayah/kategori/dampak/status | `Select` | |
| Tabel Matriks & admin | `Table` + `Pagination` | Pertahankan zebra/hover |
| Modal detail tiket & lightbox | `Dialog` | |
| Custom alert (`showCustomAlert`) | `AlertDialog` + `Toast` | |
| Live chat window | `Sheet` / `Popover` | |
| FAQ (`details/summary`) | `Accordion` | Boleh tetap native untuk paritas |
| Badge status | `Badge` (varian warna) | Merah/kuning/hijau persis |
| Kartu kanal (5 kanal) | `Card` | |

---

## 10. Non-Functional Requirements

### 10.1 Keamanan (menutup temuan audit)
| ID | Kebutuhan |
|---|---|
| SEC-01 | Hapus semua kredensial default & blok DEMO dari kode produksi |
| SEC-02 | Cookie sesi `HttpOnly; Secure; SameSite=Strict` + CSRF (Sanctum) |
| SEC-03 | Security header: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS` |
| SEC-04 | Sanitasi/escape output di semua konsumen (API & render) — cegah stored XSS |
| SEC-05 | Rate limiting: login (per akun+IP), POST pengaduan, survei |
| SEC-06 | Validasi & whitelist mass-assignment (`$fillable` / FormRequest) |
| SEC-07 | Otorisasi Policy per resource (cegah IDOR/BOLA) |
| SEC-08 | Audit log aksi admin (siapa, kapan, apa) |
| SEC-09 | Lampiran: validasi MIME/ukuran, simpan di storage privat, scan |
| SEC-10 | reCAPTCHA diverifikasi di server |
| SEC-11 | Tiket internal tidak terekspos ke endpoint publik |

### 10.2 Kualitas
- **Paritas visual**: uji snapshot/regression (Playwright screenshot) tiap halaman ID vs EN, light vs dark.
- **Aksesibilitas**: WCAG 2.1 AA (shadcn/Radix membantu), fokus keyboard, ARIA.
- **Performa**: lazy-load route, image optimization, caching TanStack Query.
- **SEO**: meta & prerender untuk halaman publik.
- **Observability**: Laravel log + health endpoint `/api/health`.
- **Backup**: DB harian, retensi arsip sesuai aturan pemerintah.

### 10.3 Kepatuhan
- UU No. 27/2022 (Pelindungan Data Pribadi), UU No. 25/2009 (Pelayanan Publik), Perpres 76/2013 & PermenPAN-RB 62/2018 (SP4N-LAPOR!), UU 11/2008 & 19/2016 (ITE).

---

## 11. Strategi Migrasi Data

1. **Inventaris** skema & data node saat ini (`sigap-api` — kecil: tiket, akun, kawasan, kanal, setting).
2. **Mapping** kolom lama → tabel baru (§6), termasuk `tingkatDampak` → `impact`, `prioritas` → `priority`, `tenggat_sla` → `sla_due_at`.
3. **Seeder/Importer** idempotent (Laravel command `tickets:import`).
4. **Backfill** klasifikasi: hitung ulang `priority` & `sla_due_at` dari `impact` yang benar (memperbaiki bug).
5. **Rekonsiliasi** jumlah baris & checksum sebelum/sesudah.
6. **Cutover** dengan maintenance window; rollback plan (dump pra-migrasi).
7. Bersihkan data uji hasil audit (TKT-2 s.d. TKT-23) kecuali memang diminta.

---

## 12. Keputusan Terkunci (Resolved)

Semua pertanyaan terbuka sebelumnya **sudah diputuskan** (lihat §4.2):

| # | Keputusan |
|---|---|
| D1 | **Satu repo Laravel** (Inertia + React), dengan **lapisan API `/api/v1/*` siap dikeluarkan kapan pun diminta** |
| D2 | **PostgreSQL 16** |
| D3 | Auth Warga: **NIK + Password** |
| D4 | Lampiran: **Disk lokal** (`storage/app/private`) |
| D5 | Real-time: **Laravel Reverb** saja |
| D6 | Peta: **Leaflet** |
| D7 | Integrasi SP4N/WBS: **stub adapter** dahulu |
| D8 | Lingkungan: **Docker Compose**, prod baru `app2.andimohamad.my.id` (stack `app2-sigap`), staging opsional `staging-app2.andimohamad.my.id`; `app1` dialihkan saat cutover |
| D9 | Data spasial kawasan: **dummy** dahulu |
| D10 | Gateway WhatsApp: **tidak dipakai dulu** (email/in-app saja) |

### Sisa yang masih perlu dijawab (non-blocking)
1. **Sumber shapefile kawasan** (nanti saat dummy diganti data nyata).
2. **Kebijakan retensi & anonimisasi** data pribadi (UU PDP).
3. **SMTP/email** kementerian untuk notifikasi (penyedia & kredensial).

> ✅ **Diperbarui 12 Okt 2026:** deploy memakai Docker; SIGAP baru di `app2.andimohamad.my.id` (lihat `docs/PRD-DEPLOY.md`).

---

## 13. Rencana Bertahap (High-Level)

| Fase | Fokus | Keluaran |
|---|---|---|
| **F0** | Setup & design system | Repo Laravel+React, Vite, Tailwind config diport, shadcn/ui ter-theme, parity baseline screenshot |
| **F1** | Data & Auth | Skema DB, migrasi data, Sanctum auth, RBAC/policy, session |
| **F2** | Halaman publik | 14 route dengan paritas visual penuh + dark/i18n |
| **F3** | Proses bisnis tiket | Pengaduan publik & internal, pelacakan, SLA benar, survei |
| **F4** | Portal warga & admin inti | Portal warga, matriks, manajemen tiket, ubah status, tanggapan |
| **F5** | Modul admin sisa | Kawasan, kanal, daftar admin, input manual, **chat real-time (Reverb)**, pengaturan |
| **F6** | Keamanan & hardening | Semua SEC-01..11, header, audit log, pentest |
| **F7** | Data terbuka, peta, integrasi | Laporan harian/bulanan, **peta Leaflet**, **stub adapter** SP4N/WBS |
| **F8** | UAT & cutover | Uji paritas, pelatihan admin, go-live, monitoring |

---

## 14. Kriteria Penerimaan (Acceptance)

- [ ] Semua 14 halaman publik + 9 sub-halaman admin dapat diakses dengan **tampilan identik** (light/dark, ID/EN).
- [ ] Semua endpoint yang dipanggil UI berstatus **bukan 404** dan mengembalikan data nyata (bukan dummy).
- [ ] Tidak ada kredensial/demo hardcoded; `admin123`/`warga123` tidak berlaku.
- [ ] `tingkatDampak` memetakan ke priority & SLA dengan benar; `sla_pct` akurat.
- [ ] Tiket internal tidak dapat diakses publik.
- [ ] Field kawasan/koordinat/lampiran/kontak tersimpan.
- [ ] Security header & cookie `Secure` aktif; XSS tersanitasi.
- [ ] Data pra-migrasi terverifikasi utuh (0 kehilangan).
- [ ] Test otomatis hijau (backend ≥80% modul inti; E2E alur utama).
- [ ] Dokumentasi API (OpenAPI) & panduan deploy tersedia.

---

## 15. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Paritas visual meleset | Baseline screenshot + review desain tiap fase |
| Kehilangan data saat migrasi | Dump ganda, importer idempotent, rekonsiliasi |
| Cakupan kerja besar (70% modul kosong) | Prioritaskan fase; modul dummy dilabeli jelas sampai selesai |
| Integrasi SP4N/WBS tidak tersedia | Adapter/stub dengan kontrak jelas |
| Adopsi admin | Pelatihan + panduan + UAT bersama admin kawasan |

---

## Lampiran A — Inventaris Endpoint Backend (kondisi 05 Okt 2026)

**Sudah ada & berfungsi:** `POST /api/auth/login`, `POST /api/admin/logout`, `GET /api/admin/session`, `GET /api/warga/session|profile|tickets`, `PATCH /api/warga/profile`, `POST /api/warga/logout`, `POST /api/pengaduan`, `POST /api/pengaduan/internal`, `GET /api/tiket/{nomor}`, `GET /api/admin/tickets`, `GET /api/admin/rekap`, `POST /api/admin/tickets/{nomor}/status`, `GET /api/health`.

**Masih 404 (harus dibangun):** tiket internal, kawasan, kanal, admins, dashboard, pengaturan/SLA/kategori, chat, notifikasi, survei, input-manual, integrasi SP4N/WBS, GET pengaduan.

## Lampiran B — Token Desain (dipertahankan)
Warna: `primary #0E5B72`, `primaryLight #0093B6`, `primarySoft #E5F4F7`, `secondary #C3A167`, `dashBlue #0093B6`, `light #F3F4F6`, `darkBg #0f172a`, `darkCard #1e293b`. Font: **Inter** (300–800). `darkMode: class`.