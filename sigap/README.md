# SIGAP — Sistem Pengelolaan Pengaduan Masyarakat

*Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas* — Kementerian Transmigrasi Republik Indonesia.

Migrasi dari SPA statis (`index.html` ~323 KB + `sigap-api`) ke **Laravel 12 · React 19 (Inertia) · Tailwind CSS · shadcn/ui**, tanpa mengubah tampilan dan perilaku yang sudah ada (*in-place behavior-preserving*, PRD §1).

| Berkas | Isi |
|---|---|
| `../docs/PRD.md` | Product Requirements Document |
| `../docs/TECH-SPEC.md` | Spesifikasi teknis (arsitektur, kontrak API, SEC-01..11) |
| `../docs/openapi.yaml` | Kontrak API `/api/v1` |
| `../docs/DEPLOY.md` | Panduan deploy Docker & cutover |
| `../docs/PRD-DEPLOY.md` | Sasaran, tahapan & kriteria selesai deploy |

> **Struktur repositori.** Root repo Git adalah folder **induk** yang berisi `docs/` dan `sigap/`
> (aplikasi Laravel ini). Workflow CI berada di `.github/workflows/` pada root tersebut dan
> menjalankan semua perintah dengan `working-directory: sigap`.

---

## Prasyarat

- PHP **8.4** (ekstensi: `cli`, `sqlite3`, `pgsql`, `mbstring`, `xml`, `curl`, `zip`, `gd`, `bcmath`, `intl`, `pcntl`, `redis`)
- Composer 2
- Node.js **22** (≥ 22.12) & npm
- (opsional) PostgreSQL 16 — sama dengan produksi
- (opsional) Playwright untuk E2E

> Catatan: lock file memakai `symfony/string` v8 yang butuh **PHP ≥ 8.4.1**.

## Instalasi (lokal)

```bash
composer install
cp .env.example .env                # default lokal: SQLite, reCAPTCHA & realtime nonaktif
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed          # master: kategori, kawasan, kanal, pengaturan
npm ci
npm run build                       # .env sudah final dulu — VITE_* ditanam saat build
php artisan sigap:admin             # buat akun super_admin pertama
```

**Opsi PostgreSQL 16 lokal** (disarankan sebelum rilis, karena produksi memakai PostgreSQL):

```bash
sudo -u postgres psql -c "CREATE ROLE sigap LOGIN PASSWORD 'sigap';"
sudo -u postgres psql -c "CREATE DATABASE sigap OWNER sigap;"
sudo -u postgres psql -c "CREATE DATABASE sigap_test OWNER sigap;"   # untuk Pest
# .env: DB_CONNECTION=pgsql, DB_HOST=127.0.0.1, DB_PORT=5432,
#       DB_DATABASE=sigap, DB_USERNAME=sigap, DB_PASSWORD=sigap
php artisan migrate --seed
```

**Kunci NIK (`NIK_HASH_KEY`)**: NIK disimpan terenkripsi (APP_KEY) dan dicari lewat
*blind index* HMAC berkunci `NIK_HASH_KEY` (terpisah dari APP_KEY). Lokal/testing boleh
kosong (jatuh ke APP_KEY); produksi/staging WAJIB diisi. **Jangan pernah mengganti
`NIK_HASH_KEY` tanpa `php artisan sigap:rehash-nik`** (menghitung ulang `nik_hash` &
`reporter_nik_hash` dari NIK terdekripsi, per-chunk dalam satu transaksi). Rotasi APP_KEY
dilakukan lewat `APP_PREVIOUS_KEYS` (kunci lama tetap dipakai untuk dekripsi).

**Realtime (Reverb) lokal**: isi `REVERB_APP_KEY`/`REVERB_APP_SECRET` (acak), set
`BROADCAST_CONNECTION=reverb`, biarkan `REVERB_*`/`VITE_REVERB_*` = `localhost:8080 http`,
lalu `npm run build` ulang. Key kosong = realtime dilewati (UI tetap jalan dengan polling).

Jalankan:

```bash
php artisan serve                       # http://127.0.0.1:8000
php artisan reverb:start --port=8080    # WebSocket (opsional di dev)
php artisan queue:listen                # worker notifikasi
php artisan schedule:work               # scheduler (opsional di dev)
```

Atau satu perintah untuk dev: `composer dev` (server + queue + log + Vite HMR di
`http://127.0.0.1:5173` + Reverb). CSP lokal otomatis mengizinkan server Vite & Reverb lokal.

## Asisten AI (contact center)

Nonaktif bawaan. Untuk mencoba lokal **tanpa API key**:

```bash
# .env
AI_ENABLED=true
AI_DRIVER=fake          # jawaban tiruan dari Basis Pengetahuan
php artisan db:seed --class=KnowledgeSeeder
php artisan queue:work  # untuk fitur "Buat dari dokumen resmi"
```

Untuk model sungguhan (OpenCode Zen, Ollama, vLLM) set `AI_DRIVER=openai`, `AI_BASE_URL`, `AI_API_KEY`,
`AI_MODEL` — lihat `../docs/DEPLOY.md` §13. Tes selalu memakai `AI_ENABLED=false` (diatur di `phpunit.xml`).

## Akun

**Tidak ada kredensial default** (SEC-01). Akun dibuat eksplisit:

```bash
php artisan sigap:admin                 # interaktif (super_admin / admin_kawasan)
```

## Perintah khusus SIGAP

| Perintah | Fungsi |
|---|---|
| `php artisan sigap:admin` | Membuat akun admin/petugas (interaktif) |
| `php artisan sigap:sync-channels` | Sinkronisasi kanal nasional (STUB adapter D7) + tulis `channel_sync_logs` |
| `php artisan sigap:ews-check` | Peringatan EWS untuk tiket melewati SLA (dihitung dari `ews_enabled`) |
| `php artisan sigap:e2e-setup` | Siapkan DB + akun uji untuk Playwright — **menghapus DB**, sehingga hanya jalan bila `APP_ENV` local/testing **dan** DB SQLite/host lokal (tanpa opsi `--force`) |

Jadwal (TECH-SPEC §11.2): `sigap:sync-channels` harian 06:00, `sigap:ews-check` harian 07:00.

## Pengujian

```bash
php artisan test          # Pest — feature/unit (187 tes, SQLite in-memory)
npm test                  # Vitest — unit frontend (utils, sigap.ts, reverb, recaptcha, hooks)
npm run test:e2e          # Playwright — alur utama (DB e2e.sqlite terpisah)
```

Tes infrastruktur ada di `tests/Feature/Infra` (rate limit login/lacak/health, CSP nonce
produksi, Ziggy per peran, proxy tepercaya, origin Reverb, perintah E2E).

## Cek lokal (sebelum push)

Semua yang dijalankan CI (`../.github/workflows/tests.yml` & `lint.yml` di root repo) bisa dijalankan lokal dari folder `sigap/`:

```bash
# Frontend
npx vitest run                         # unit test
npx tsc --noEmit                       # TypeScript strict — harus 0 galat
npx eslint resources/js --max-warnings=0
npm run format:check                   # Prettier
npm run build                          # build produksi (dibutuhkan juga oleh Pest)

# Backend
php artisan test                       # Pest di SQLite in-memory
DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 \
  DB_DATABASE=sigap_test DB_USERNAME=sigap DB_PASSWORD=sigap \
  php artisan test                     # Pest di PostgreSQL 16 (seperti produksi)
vendor/bin/pint --test                 # gaya kode PHP

# Keamanan dependensi
npm audit --omit=dev --audit-level=high
composer audit                         # butuh akses ke packagist.org
```

Uji CSP produksi secara manual: `APP_ENV=production php artisan serve`, buka halaman,
lalu pastikan Console browser bebas pelanggaran CSP dan setiap `<script>` membawa `nonce`.

E2E memakai database terpisah `database/e2e.sqlite` + akun uji dari `sigap:e2e-setup`
(kredensial disimpan di `storage/app/e2e/credentials.json`, tidak ada di source).

## Alur bisnis (ringkas)

1. Publik isi formulir (`/pengaduan/baru`) → tiket + SLA dihitung dari dampak & kategori (BUG B1/B2 diperbaiki di `SlaCalculator`).
2. Pelapor/tamu melacak di `/lacak` atau `/lacak/{nomor}`.
3. Admin membuka panel (`/admin` → Matriks, Tiket, dsb), mengubah status → riwayat tersimpan.
4. Saat status **Selesai**, halaman lacak menampilkan survei kepuasan (1..5 bintang).
5. Notifikasi: lonceng admin (kanal privat per pengguna `user.{id}` via Reverb — event `.ticket.changed` & `.notification.incoming`) + surel (D10). WhatsApp dinonaktifkan (PRD D10).
6. Kanal nasional (SP4N-LAPOR!, WBS) tersinkron lewat STUB adapter — tukar implementasi lewat `ChannelAdapterManager`.

## Struktur singkat

```
app/Http/Controllers/{Web,Api/V1}   # Web = Inertia, Api/V1 = REST (kontrak sama)
app/Services/                       # TicketService, SlaCalculator, StatsService,
                                    # NotificationService, Channels/*Adapter
app/Console/Commands/               # sigap:admin, sigap:sync-channels, sigap:ews-check
resources/js/pages/{public,admin,warga}
tests/{Feature,Unit}                # Pest
tests/e2e                           # Playwright
```
