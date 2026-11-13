# Suite paritas Contact Center

Membuktikan Next.js berperilaku dan tampil **identik** dengan Laravel (tag `laravel-baseline`).
Aturan visual: `docs/RENCANA-REWRITE-NEXTJS.md` §8.3 (`maxDiffPixels: 0`, `threshold: 0`, tanpa mask di S1).

| Folder | Isi |
|---|---|
| `tests/http.spec.ts` | halaman S1 → 200, judul, meta, h1/h2, header tamu; redirect lama → 301 + `Location` persis |
| `tests/visual.spec.ts` | screenshot full page S1 × desktop 1440 / tablet 768 / ponsel 375 × terang/gelap + header tamu |
| `visual/<platform>/` | baseline = tampilan Laravel |
| `fixtures/` | vektor JSON dari kelas PHP asli (`cc:ekspor-fixture`); `fixtures/kripto/` milik paket B |

## Menjalankan terhadap Laravel (acuan)

Sekali saja, di `sigap/`:

```bash
composer install && npm ci
cp .env.example .env && php artisan key:generate   # AI_ENABLED=false, tanpa rahasia asli
npx vite build
```

Lalu di `parity/`:

```bash
npm ci
npx playwright install chromium
npx playwright test
```

Tanpa `BASE_URL`, `scripts/laravel.sh` menyalakan Laravel di `127.0.0.1:8124` dengan SQLite terpisah
(`sigap/database/paritas.sqlite`), `php artisan sigap:e2e-setup` (data dihapus & di-seed ulang tiap run),
lalu `php artisan serve`.

## Menjalankan terhadap Next.js

```bash
BASE_URL=http://127.0.0.1:3000 npx playwright test
```

Target harus memakai snapshot data yang sama dengan Laravel (seed `sigap:e2e-setup`). Selisih piksel
tersimpan di `test-results/` (gambar expected/actual/diff); `npx playwright show-report` untuk melihatnya.

## Memperbarui baseline

Hanya dari Laravel, dan hanya bila tampilan Laravel memang berubah (atau untuk platform baru, mis. container
Linux CI): `npm run baseline`, lalu jalankan `npx playwright test` dua kali — keduanya harus hijau tanpa
mengubah apa pun. Jangan menambah toleransi atau mask untuk meloloskan test.

## Membuat ulang fixtures

```bash
cd sigap && php artisan cc:ekspor-fixture        # menulis ../parity/fixtures/*.json
```

Keluaran deterministik (jam dibekukan, tanpa acak); dijalankan dua kali harus tanpa diff. Header berkas
mencatat kelas sumber, commit, dan `zona_waktu_aplikasi` (dari `APP_TIMEZONE`, bawaan `UTC`). Vektor SLA
diekspor untuk UTC dan Asia/Jakarta sekaligus karena nilai produksi belum dipastikan.
