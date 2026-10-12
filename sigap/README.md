# SIGAP — Sistem Pengelolaan Pengaduan Masyarakat

*Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas* — Kementerian Transmigrasi Republik Indonesia.

Migrasi dari SPA statis (`index.html` ~323 KB + `sigap-api`) ke **Laravel 12 · React 19 (Inertia) · Tailwind CSS · shadcn/ui**, tanpa mengubah tampilan dan perilaku yang sudah ada (*in-place behavior-preserving*, PRD §1).

| Berkas | Isi |
|---|---|
| `../docs/PRD.md` | Product Requirements Document |
| `../docs/TECH-SPEC.md` | Spesifikasi teknis (arsitektur, kontrak API, SEC-01..11) |
| `../docs/openapi.yaml` | Kontrak API `/api/v1` |
| `../docs/DEPLOY.md` | Panduan deploy & cutover |

---

## Prasyarat

- PHP **8.4** (ekstensi: `cli`, `sqlite3`, `mbstring`, `xml`, `curl`, `zip`, `gd`, `bcmath`, `intl`, `pcntl`, `redis`)
- Composer 2
- Node.js 20+ & npm
- (opsional) Playwright untuk E2E

> Catatan: lock file memakai `symfony/string` v8 yang butuh **PHP ≥ 8.4.1**.

## Instalasi (lokal)

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed          # master: kategori, kawasan, kanal, pengaturan
npm install
npm run build
```

Jalankan:

```bash
php artisan serve                       # http://127.0.0.1:8000
php artisan reverb:start --port=8080    # WebSocket (opsional di dev)
php artisan queue:listen                # worker notifikasi
php artisan schedule:work               # scheduler (opsional di dev)
```

Atau satu perintah untuk dev: `composer dev`.

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
| `php artisan sigap:e2e-setup` | Siapkan DB + akun uji untuk Playwright (dev/test saja) |

Jadwal (TECH-SPEC §11.2): `sigap:sync-channels` harian 06:00, `sigap:ews-check` harian 07:00.

## Pengujian

```bash
php artisan test          # Pest — feature/unit (84 tests, in-memory sqlite)
npm test                  # Vitest — unit frontend (utils, sigap.ts, hooks)
npm run test:e2e          # Playwright — alur utama (DB e2e.sqlite terpisah)
```

E2E memakai database terpisah `database/e2e.sqlite` + akun uji dari `sigap:e2e-setup`
(kredensial disimpan di `storage/app/e2e/credentials.json`, tidak ada di source).

## Alur bisnis (ringkas)

1. Publik isi formulir (`/pengaduan/baru`) → tiket + SLA dihitung dari dampak & kategori (BUG B1/B2 diperbaiki di `SlaCalculator`).
2. Pelapor/tamu melacak di `/lacak` atau `/lacak/{nomor}`.
3. Admin membuka panel (`/admin` → Matriks, Tiket, dsb), mengubah status → riwayat tersimpan.
4. Saat status **Selesai**, halaman lacak menampilkan survei kepuasan (1..5 bintang).
5. Notifikasi: lonceng admin (`admin.notifications` via Reverb) + surel (D10). WhatsApp dinonaktifkan (PRD D10).
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
