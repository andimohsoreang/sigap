# Tech Spec — SIGAP (Laravel + React + Tailwind + shadcn/ui)
## Pendamping PRD v1.0 — Arsitektur, Skema DB, Kontrak API, Konvensi

| Field | Nilai |
|---|---|
| Dokumen | Technical Specification |
| Versi | 1.0 |
| Tanggal | 05 Okt 2026 |
| Mengacu | `docs/PRD.md` |
| Keputusan terkunci | D1–D10 (lihat PRD §4.2) |

---

## 1. Stack & Versi

| Komponen | Versi | Catatan |
|---|---|---|
| PHP | 8.3 | typed properties, readonly, enums |
| Laravel | 11.x | Inertia starter kit resmi sebagai basis |
| PostgreSQL | 16 | `jsonb`, `timestamptz`, `citext` (opsional) |
| Node | 20 LTS | build Vite |
| Inertia.js | 2.x | adapter React |
| React | 18.x | TypeScript 5.x |
| Vite | 5.x | |
| Tailwind CSS | 3.4 | port dari `tailwind.config.js` lama |
| shadcn/ui | latest | Radix + CVA + tailwind-merge |
| TanStack Query | 5.x | untuk fetch ke `/api/v1` (chat, polling) |
| React Hook Form + Zod | latest | validasi FE |
| Zustand | 4.x | UI state (tema, bahasa) |
| Laravel Sanctum | 4.x | auth | 
| Laravel Reverb | 1.x | WebSocket |
| Laravel Echo + pusher-js | latest | klien Reverb |
| Leaflet + react-leaflet | 1.9 / 4.x | peta |
| SheetJS (xlsx) | 0.18.5 | ekspor Excel (dipertahankan) |
| Lucide React | latest | ikon komponen shadcn |
| FontAwesome 6 | 6.4 CDN | ikon lama agar paritas |
| Pest / PHPUnit | latest | test backend |
| Playwright | latest | uji paritas visual E2E |

---

## 2. Struktur Repo (satu repo Laravel — D1)

```
sigap/
├─ app/
│  ├─ Enums/                      # TicketStatus, TicketImpact, TicketPriority, UserRole, Visibility
│  ├─ Http/
│  │  ├─ Controllers/
│  │  │  ├─ Web/                  # Inertia: BerandaController, KatalogController, ...
│  │  │  │  └─ Admin/             # Inertia admin pages
│  │  │  └─ Api/V1/               # JSON API (siap dikeluarkan)
│  │  │     ├─ AuthController.php
│  │  │     ├─ PengaduanController.php
│  │  │     ├─ TiketController.php
│  │  │     ├─ WargaController.php
│  │  │     ├─ SurveiController.php
│  │  │     └─ Admin/
│  │  ├─ Middleware/             # EnsureRole, SecurityHeaders
│  │  ├─ Requests/               # FormRequest dipakai bersama Web & Api
│  │  │  ├─ StorePengaduanRequest.php
│  │  │  ├─ StorePengaduanInternalRequest.php
│  │  │  ├─ LoginRequest.php
│  │  │  └─ ...
│  │  └─ Resources/V1/           # API Resource (bentuk JSON)
│  ├─ Models/                     # User, Ticket, TicketHistory, TicketReply, Survey, Category, Region, Channel, Setting, ChatConversation, ChatMessage
│  ├─ Policies/                   # TicketPolicy, UserPolicy, RegionPolicy, ...
│  ├─ Services/                   # LOGIKA BISNIS (dipakai Web & Api)
│  │  ├─ TicketService.php
│  │  ├─ SlaCalculator.php
│  │  ├─ PengaduanService.php
│  │  ├─ SurveyService.php
│  │  ├─ AttachmentService.php
│  │  └─ Channels/
│  │     ├─ PengaduanChannelAdapter.php   # interface (D7)
│  │     ├─ Sp4nLaporStubAdapter.php
│  │     └─ WbsStubAdapter.php
│  ├─ Events/                     # TicketStatusChanged, ChatMessageSent, ...
│  ├─ Notifications/              # InternalTicketNotification, ...
│  └─ Providers/
├─ bootstrap/app.php
├─ config/                        # reverb.php, sanctum.php, inertia...
├─ database/
│  ├─ migrations/
│  ├─ seeders/
│  └─ factories/
├─ resources/
│  ├─ js/
│  │  ├─ app.tsx                  # entry Inertia
│  │  ├─ pages/                   # halaman React (paritas 14 + admin 9)
│  │  ├─ components/
│  │  │  ├─ ui/                   # shadcn/ui (generated)
│  │  │  └─ sigap/                # komponen khusus (Navbar, Footer, Logo, ...)
│  │  ├─ layouts/                 # PublicLayout, AdminLayout
│  │  ├─ lib/                     # utils.ts (cn), api.ts, echo.ts, i18n.ts
│  │  ├─ hooks/                   # useTheme, useLang, useAuth
│  │  └─ types/                   # tipe TS bersama
│  └─ css/
│     └─ app.css                  # @tailwind + CSS variables SIGAP
├─ routes/
│  ├─ web.php                     # route Inertia
│  ├─ api.php                     # /api/v1/* (JSON)
│  ├─ channels.php                # Reverb channel auth
│  └─ console.php
├─ public/build/                  # hasil Vite
├─ storage/app/private/           # lampiran (D4)
├─ tests/
│  ├─ Feature/
│  └─ Unit/
├─ components.json                # konfigurasi shadcn/ui
├─ tailwind.config.js
└─ vite.config.ts
```

**Aturan emas (dari PRD §4.3):** controller tidak berisi logika bisnis; semua lewat `Services/`, `Requests/`, `Resources/`, `Policies/` agar jalur Inertia dan jalur API identik.

---

## 3. Skema Database (PostgreSQL 16)

### 3.1 Enum (native PostgreSQL)

```sql
CREATE TYPE user_role AS ENUM ('warga','pegawai','admin_kawasan','super_admin');
CREATE TYPE ticket_status AS ENUM ('baru','verifikasi','diproses','selesai','ditolak');
CREATE TYPE ticket_impact AS ENUM ('rendah','sedang','tinggi','kritis');
CREATE TYPE ticket_priority AS ENUM ('umum','prioritas','darurat');
CREATE TYPE ticket_visibility AS ENUM ('publik','anonim','rahasia');
CREATE TYPE channel_type AS ENUM ('sosmed','kantor','nasional','internal');
```

### 3.2 Tabel

```sql
-- users
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  nik             CHAR(16) UNIQUE,                 -- wajib utk warga; nullable utk admin/pegawai
  username        VARCHAR(50) UNIQUE,              -- utk admin/pegawai
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(150),
  phone           VARCHAR(30),
  role            user_role NOT NULL DEFAULT 'warga',
  password        VARCHAR(255) NOT NULL,           -- Argon2id
  region_id       BIGINT REFERENCES regions(id),
  unit            VARCHAR(120),                    -- utk pegawai internal
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  remember_token  VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_warga_nik CHECK (role <> 'warga' OR nik IS NOT NULL)
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_region ON users(region_id);

-- categories
CREATE TABLE categories (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL UNIQUE,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  priority_default ticket_priority NOT NULL DEFAULT 'umum',
  sla_days        SMALLINT NOT NULL DEFAULT 14,    -- target penyelesaian (hari kerja)
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- regions (kawasan transmigrasi) — D9: data spasial DUMMY dahulu
CREATE TABLE regions (
  id              BIGSERIAL PRIMARY KEY,
  code            VARCHAR(30) NOT NULL UNIQUE,     -- KWS-001
  name            VARCHAR(150) NOT NULL,           -- SP1 Merauke
  province        VARCHAR(100),
  latitude        NUMERIC(10,6),                    -- koordinat contoh (dummy)
  longitude       NUMERIC(10,6),                    -- koordinat contoh (dummy)
  geometry        JSONB,                            -- slot GeoJSON; null selama dummy
  infrastructure_status VARCHAR(50),               -- Memadai / Berkembang
  kk_count        INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- channels
CREATE TABLE channels (
  id              BIGSERIAL PRIMARY KEY,
  type            channel_type NOT NULL,
  name            VARCHAR(120) NOT NULL,
  account_name    VARCHAR(120),
  url             VARCHAR(500),
  status          VARCHAR(30) NOT NULL DEFAULT 'aktif',
  config          JSONB DEFAULT '{}'::jsonb,       -- endpoint/key integrasi (encrypted bila sensitif)
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- tickets
CREATE TABLE tickets (
  id              BIGSERIAL PRIMARY KEY,
  ticket_no       VARCHAR(20) NOT NULL UNIQUE,     -- TKT-1 (nomor tampil)
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  status          ticket_status NOT NULL DEFAULT 'baru',
  priority        ticket_priority NOT NULL DEFAULT 'umum',
  impact          ticket_impact,                    -- dari form "tingkatDampak"
  visibility      ticket_visibility NOT NULL DEFAULT 'publik',
  latitude        NUMERIC(10,6),
  longitude       NUMERIC(10,6),
  attachment_path VARCHAR(500),
  is_internal     BOOLEAN NOT NULL DEFAULT FALSE,
  category_id     BIGINT REFERENCES categories(id),
  region_id       BIGINT REFERENCES regions(id),
  channel_id      BIGINT REFERENCES channels(id),
  assignee_id     BIGINT REFERENCES users(id),
  reporter_id     BIGINT REFERENCES users(id),       -- NULL bila anonim
  reporter_name   VARCHAR(150),
  reporter_nik    CHAR(16),                          -- utk anonim (tanpa akun)
  reporter_email  VARCHAR(150),
  reporter_phone  VARCHAR(30),
  sla_due_at      TIMESTAMPTZ,                       -- dihitung SlaCalculator
  responded_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_internal_no_region CHECK (is_internal = FALSE OR region_id IS NULL)
);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_region ON tickets(region_id);
CREATE INDEX idx_tickets_category ON tickets(category_id);
CREATE INDEX idx_tickets_impact ON tickets(impact);
CREATE INDEX idx_tickets_internal ON tickets(is_internal);
CREATE INDEX idx_tickets_sla ON tickets(sla_due_at);
CREATE INDEX idx_tickets_search ON tickets USING GIN (to_tsvector('indonesian', title || ' ' || description));

-- ticket_histories (audit trail)
CREATE TABLE ticket_histories (
  id              BIGSERIAL PRIMARY KEY,
  ticket_id       BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status     ticket_status,
  to_status       ticket_status,
  actor_id        BIGINT REFERENCES users(id),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_hist_ticket ON ticket_histories(ticket_id);

-- ticket_replies (tanggapan admin/petugas)
CREATE TABLE ticket_replies (
  id              BIGSERIAL PRIMARY KEY,
  ticket_id       BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id       BIGINT REFERENCES users(id),
  body            TEXT NOT NULL,
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reply_ticket ON ticket_replies(ticket_id);

-- surveys
CREATE TABLE surveys (
  id              BIGSERIAL PRIMARY KEY,
  ticket_id       BIGINT NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- settings (key-value, mis. SLA, notifikasi, kategori aktif)
CREATE TABLE settings (
  id              BIGSERIAL PRIMARY KEY,
  key             VARCHAR(100) NOT NULL UNIQUE,
  value           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- chat (D5 — Reverb)
CREATE TABLE chat_conversations (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id),      -- NULL utk tamu
  guest_token     VARCHAR(64),                      -- identitas tamu anonim
  subject         VARCHAR(200),
  last_message_at TIMESTAMPTZ,
  unread_admin    INTEGER NOT NULL DEFAULT 0,
  unread_user     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE chat_messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id       BIGINT REFERENCES users(id),      -- NULL bila tamu/sistem
  sender_type     VARCHAR(20) NOT NULL DEFAULT 'user', -- user|admin|system
  body            TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chat_msg_conv ON chat_messages(conversation_id, created_at);

-- channel sync log (stub adapter)
CREATE TABLE channel_sync_logs (
  id              BIGSERIAL PRIMARY KEY,
  channel_id      BIGINT REFERENCES channels(id),
  pulled_count    INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'berhasil',
  message         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Aturan SLA (implementasi `SlaCalculator`)

```php
// pemetaan dampak -> prioritas -> SLA (memperbaiki bug B1/B2)
"kritis" => priority: "darurat",  responseHours: 24,  resolveDays: 3
"tinggi" => priority: "prioritas", responseHours: 72,  resolveDays: 7
"sedang" => priority: "umum",      responseHours: 120, resolveDays: 14
"rendah" => priority: "umum",      responseHours: 120, resolveDays: 14

// sla_due_at = created_at + resolveDays hari kerja (bukan hari kalender),
// kecuali terdapat kategori dengan sla_days khusus -> pakai yang lebih ketat.
```

- `sla_due_at` diisi saat tiket dibuat.
- `responded_at` diisi saat status pertama kali berpindah dari `baru`.
- `sla_pct` = `(tiket tanpa pelanggaran SLA / total tiket selesai) × 100` — rumus diperbaiki (B3).
- EWS: tiket `baru|verifikasi|diproses` dengan `sla_due_at < now()`.

---

## 4. Kontrak API (`/api/v1/*`) — JSON siap-pakai

Base: `https://<domain>/api/v1`. Auth: Sanctum. Untuk SPA (Inertia) memakai cookie sesi; untuk klien eksternal memakai Bearer token.

| Method | Endpoint | Auth | Body / Query |
|---|---|---|---|
| POST | `/auth/login` | — | `{identifier, password}` → `{role, nama, id}` |
| POST | `/auth/logout` | any | — |
| GET | `/auth/session` | any | → `{authenticated, role, nama}` |
| POST | `/pengaduan` | — | FormRequest `StorePengaduanRequest` |
| POST | `/pengaduan/internal` | — | `StorePengaduanInternalRequest` |
| GET | `/tiket/{ticket_no}` | — | publik (tanpa tiket internal) |
| POST | `/survei/{ticket_no}` | — | `{rating, comment?}` |
| GET | `/katalog/kanal` | — | daftar kanal publik |
| GET | `/warga/session` | warga | |
| GET | `/warga/profile` | warga | |
| PATCH | `/warga/profile` | warga | `{email?, phone?, password?}` |
| GET | `/warga/tickets` | warga | riwayat milik sendiri |
| GET | `/regions` | — | data kawasan (peta Leaflet) |
| GET | `/admin/tickets` | admin | filter `status,region,category,impact,q,page` |
| GET | `/admin/tickets/{ticket_no}` | admin | detail + riwayat + tanggapan |
| POST | `/admin/tickets/{ticket_no}/status` | admin | `{status, note?}` |
| POST | `/admin/tickets/{ticket_no}/tanggapan` | admin | `{body, is_public?}` |
| GET | `/admin/tiket-internal` | admin | + statistik |
| POST | `/admin/input-manual` | admin | `StoreInputManualRequest` |
| GET/POST | `/admin/kawasan` | admin | CRUD kawasan |
| PUT/DELETE | `/admin/kawasan/{id}` | admin | |
| GET/POST | `/admin/kanal` | admin | CRUD kanal |
| GET/POST | `/admin/admins` | super_admin | CRUD admin |
| GET | `/admin/rekap` | admin | `{total, byStatus, ews, sla_pct}` |
| GET/PUT | `/admin/pengaturan` | super_admin | SLA/EWS/kategori/notifikasi |
| POST | `/admin/integrasi/{sp4n\|wbs}` | super_admin | jalankan stub sync |
| GET | `/admin/chat` | admin | daftar percakapan |
| GET | `/chat/{conversation}/messages` | any | riwayat pesan |
| POST | `/chat/{conversation}/messages` | any | kirim pesan (+ broadcast Reverb) |
| GET | `/health` | — | `{ok, service, tickets, time}` |

**Konvensi error** (pertahankan pesan Bahasa Indonesia yang sudah ada):
```json
{ "error": "NIK harus 16 digit angka." }          // 400/422
{ "authenticated": false, "error": "Akses khusus petugas" } // 401
{ "error": "Terlalu banyak percobaan login. Coba 1 menit lagi." } // 429
```

---

## 5. Routing Web (Inertia)

```php
// routes/web.php
Route::get('/', BerandaController::class)->name('beranda');
Route::get('/katalog', KatalogController::class)->name('katalog');
Route::get('/pengaduan/baru', [PengaduanWebController::class, 'create'])->name('pengaduan.create');
Route::get('/pengaduan/internal', [PengaduanWebController::class, 'internal'])->name('pengaduan.internal');
Route::get('/lacak', [TiketWebController::class, 'track'])->name('lacak');
Route::get('/peta', PetaController::class)->name('peta');
Route::get('/masuk', [AuthWebController::class, 'show'])->name('masuk');
Route::get('/portal-warga', WargaWebController::class)->middleware('auth')->name('portal-warga');
Route::get('/pedoman-layanan', ...);
Route::get('/syarat-ketentuan', ...);
Route::get('/kebijakan-privasi', ...);
Route::get('/tentang-kami', ...);

Route::prefix('admin')->middleware(['auth','role:admin_kawasan,super_admin'])->group(function () {
  Route::get('/', [AdminWebController::class, 'dashboard'])->name('admin.dashboard');
  Route::get('/tiket', ...)->name('admin.tiket');
  Route::get('/tiket-internal', ...)->name('admin.tiket-internal');
  Route::get('/input-manual', ...)->name('admin.input-manual');
  Route::get('/chat', ...)->name('admin.chat');
  Route::get('/petugas', ...)->middleware('role:super_admin');
  Route::get('/kawasan', ...);
  Route::get('/kanal', ...);
  Route::get('/pengaturan', ...)->middleware('role:super_admin');
});
```

---

## 6. Frontend

### 6.1 Design token (`resources/css/app.css`)

```css
:root {
  --primary: 192 72% 25%;        /* #0E5B72 */
  --primary-light: 191 100% 36%; /* #0093B6 */
  --primary-soft: 190 55% 93%;   /* #E5F4F7 */
  --secondary: 40 44% 58%;       /* #C3A167 */
  --light: 220 14% 96%;          /* #F3F4F6 */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --radius: 0.5rem;
  /* ... token shadcn standar */
}
.dark {
  --background: 222 47% 11%;     /* #0f172a */
  --card: 217 33% 17%;           /* #1e293b */
  --foreground: 210 40% 98%;
}
html { transition: font-size .3s ease; }
```

`tailwind.config.js` diperluas agar **nama warna lama tetap bisa dipakai** (`primary`, `primaryLight`, `primarySoft`, `secondary`, `darkBg`, `darkCard`) sekaligus token shadcn:
```js
theme.extend.colors = {
  primary: '#0E5B72', primaryLight: '#0093B6', primarySoft: '#E5F4F7',
  secondary: '#C3A167', dashBlue: '#0093B6', light: '#F3F4F6',
  darkBg: '#0f172a', darkCard: '#1e293b',
};
darkMode: 'class';
```

### 6.2 Halaman React (paritas)
```
pages/
  beranda.tsx            katalog.tsx          pengaduan/form.tsx
  pengaduan/internal.tsx lacak.tsx            peta.tsx
  masuk.tsx              portal-warga.tsx     pedoman-layanan.tsx
  syarat-ketentuan.tsx   kebijakan-privasi.tsx tentang-kami.tsx
  admin/
    dashboard.tsx  tiket.tsx  tiket-internal.tsx  input-manual.tsx
    chat.tsx  petugas.tsx  kawasan.tsx  kanal.tsx  pengaturan.tsx
```

### 6.3 Komponen shadcn/ui yang di-generate
`button input textarea select checkbox radio-group switch label form card badge table tabs dialog alert-dialog sheet dropdown-menu popover tooltip avatar skeleton sonner pagination accordion separator scroll-area`.

### 6.4 Komponen khusus SIGAP (`components/sigap/`)
`Navbar`, `MobileMenu`, `Footer`, `Logo`, `NotificationBell`, `LiveChatWidget`, `TicketStatusBadge`, `ImpactBadge`, `SlaCell`, `RegionMap` (Leaflet), `FileUpload`, `Recaptcha`, `LanguageToggle`, `ThemeToggle`, `FontSizeControl`, `StatCard`, `DataTable` (wrapper shadcn).

### 6.5 State
- `useAuth()` → dari Inertia shared props (`auth.user`).
- `useTheme()` → dark/high-contrast (localStorage `sigapTheme`).
- `useLang()` → ID/EN (localStorage `sigapLang`), kamus di `lib/i18n.ts` (48 kunci existing).
- TanStack Query → chat, statistik, refresh data.

---

## 7. Real-time (Reverb — D5)

- `php artisan install:broadcasting` + Reverb.
- Channel privat: `chat.{conversationId}` (otorisasi di `routes/channels.php`).
- Channel admin: `admin.notifications` (EWS & tiket baru).
- Event: `ChatMessageSent`, `TicketStatusChanged`, `TicketCreated`.
- Klien: `lib/echo.ts` (Laravel Echo + pusher-js, host Reverb, auth via `/broadcasting/auth` dengan sesi Sanctum).
- Fallback: bila WebSocket gagal, widget chat menampilkan pesan "koneksi terputus" (bukan balas palsu).

---

## 7b. Notifikasi (D10 — tanpa WhatsApp)

| Kanal | Status |
|---|---|
| In-app (Reverb + notifikasi bell) | ✅ Aktif |
| Email (Laravel Notification, SMTP kementerian) | ✅ Aktif |
| WhatsApp | ⛔ **Dinonaktifkan** |

- Interface `NotificationChannel` + driver `EmailDriver`, `InAppDriver`. **Tidak ada** `WhatsAppDriver` pada fase ini.
- Field `users.phone` & preferensi "Kirim Notifikasi ke WhatsApp" pada form **tetap ditampilkan untuk paritas UI**, tetapi disimpan sebagai preferensi dan **tidak memicu pengiriman** (ditandai "segera hadir").
- Saat WA diaktifkan nanti: tambahkan `WhatsAppDriver` + binding, tanpa mengubah UI.

---

## 8. Integrasi Kanal — Stub Adapter (D7)

```php
interface PengaduanChannelAdapter {
    public function sync(): ChannelSyncResult;   // tarik tiket
    public function pullAggregate(): array;       // tarik agregat (WBS: tanpa identitas)
}

final class Sp4nLaporStubAdapter implements PengaduanChannelAdapter { /* data contoh */ }
final class WbsStubAdapter implements PengaduanChannelAdapter { /* agregat contoh */ }
```
- Binding di `ChannelsServiceProvider` berdasarkan `channels.type`.
- Setiap `sync()` menulis `channel_sync_logs`.
- Menukar ke nyata = buat `Sp4nLaporHttpAdapter` dan ganti binding; controller & UI tidak berubah.

---

## 9. Keamanan (implementasi SEC-01..11)

| ID | Implementasi konkret |
|---|---|
| SEC-01 | Tidak ada seeder kredensial default; `php artisan sigap:admin {username}` interaktif |
| SEC-02 | Sanctum stateful, cookie `HttpOnly; Secure; SameSite=Lax/Strict`; CSRF aktif |
| SEC-03 | Middleware `SecurityHeaders`: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy |
| SEC-04 | Blade/React escape + `Resource` output; sanitasi rich text bila ada |
| SEC-05 | `RateLimiter`: `login` per NIK+IP (mis. 5/menit), `pengaduan` per IP (mis. 10/10 menit), `survei` |
| SEC-06 | FormRequest + `$fillable`/`$guarded`; whitelist field |
| SEC-07 | `TicketPolicy` (warga hanya miliknya; admin kawasan hanya region-nya) |
| SEC-08 | `ticket_histories` + log admin (`activity` sederhana) |
| SEC-09 | Lampiran: validasi MIME & ukuran ≤5MB, disimpan `storage/app/private`, disajikan lewat `AttachmentController` ter-otorisasi |
| SEC-10 | reCAPTCHA diverifikasi server-side sebelum simpan |
| SEC-11 | Resource tiket publik menyembunyikan `is_internal = true` |

---

## 10. Pengujian

- **Backend (Pest)**: feature test tiap endpoint (auth, pengaduan, tiket, SLA, policy, rate limit); unit test `SlaCalculator` (kasus dampak & hari kerja). Target ≥80%.
- **Frontend (Vitest)** untuk util & hook; **Playwright** untuk E2E alur utama (buat aduan → lacak → admin ubah status → survei).
- **Paritas visual**: Playwright screenshot tiap halaman (ID/EN × light/dark) dibandingkan baseline halaman lama.
- **Keamanan**: uji tamper cookie, akses role salah (403), upload jahat, XSS tersanitasi.

---

## 11. Deployment

### 11.1 Lingkungan (D8)

| Lingkungan | Domain | Catatan |
|---|---|---|
| Produksi | `app1.andimohamad.my.id` | data nyata |
| **Staging** | **`staging-app1.andimohamad.my.id`** | data dummy/migrasi uji, Basic Auth opsional, `APP_ENV=staging`, `APP_DEBUG=false` |
| Lokal | `sigap.test` | Laravel Herd/Valet |

> ✅ Terkonfirmasi: **`staging-app1.andimohamad.my.id`**.

- Dua vhost nginx, dua database PostgreSQL, dua set `.env`, dua `.env` Reverb (app id/key beda).
- Cloudflare: subdomain staging dengan **Access/WAF** opsional agar tidak terindeks.

### 11.2 Umum
- nginx + PHP-FPM + PostgreSQL + Reverb (`supervisor` untuk `php artisan reverb:start`).
- `php artisan optimize`, `config:cache`, `route:cache`.
- Queue worker (supervisor) untuk notifikasi email/in-app.
- `npm run build` → `public/build`.
- Scheduler (`schedule:run`) untuk sinkron kanal (stub) harian & EWS.
- Di belakang Cloudflare (WebSocket didukung untuk Reverb, port 443/wss).
- Health check `/api/v1/health`.

---

## 12. Konvensi Tim

- PHP: PSR-12, Laravel Pint.
- TS: ESLint + Prettier, strict mode.
- Nama route & page konsisten memakai istilah Indonesia seperti sekarang (agar paritas).
- Commit mengikuti Conventional Commits.
- Branch: `main` (produksi), `develop`, `feat/*`, `fix/*`.