# Suite paritas Contact Center

Membuktikan Next.js berperilaku dan tampil **identik** dengan Laravel (tag `laravel-baseline`).
Aturan visual: `docs/RENCANA-REWRITE-NEXTJS.md` §8.3 (`maxDiffPixels: 0`, `threshold: 0`, tanpa mask di S1).

| Folder | Isi |
|---|---|
| `tests/http.spec.ts` | halaman S1 → 200, judul, meta, `lang="id"`, h1/h2, header tamu; header keamanan, CSP & cookie `sigap_session`; redirect lama → 301 + `Location` persis (relatif, query dibuang) |
| `tests/visual.spec.ts` | screenshot full page S1 × desktop 1440 / tablet 768 / ponsel 375 × terang/gelap + header tamu |
| `visual/<platform>/` | baseline = tampilan Laravel |
| `env/laravel.env` | konfigurasi target Laravel = cermin produksi (lihat `PRODUKSI.md`), tanpa rahasia |
| `fixtures/` | vektor JSON dari kelas PHP asli (`cc:ekspor-fixture`); `fixtures/kripto/` milik paket B |

## Menjalankan terhadap Laravel (acuan)

Sekali saja, di `sigap/`:

```bash
composer install && npm ci
```

`sigap/.env` tidak diperlukan: `scripts/laravel.sh` memuat `env/laravel.env` (nilai lingkungan menang atas
`.env`), membuat `APP_KEY`/`NIK_HASH_KEY` acak, dan menjalankan `vite build` dengan nilai `VITE_*` produksi.

Lalu di `parity/`:

```bash
npm ci
npx playwright install chromium
npx playwright test
```

Tanpa `BASE_URL`, `scripts/laravel.sh` menyalakan Laravel di `127.0.0.1:8124` dengan SQLite terpisah
(`sigap/database/paritas.sqlite`), `php artisan sigap:e2e-setup` (data dihapus & di-seed ulang tiap run),
lalu `php artisan serve`. Request ke origin selain `BASE_URL` (mis. Google reCAPTCHA) diblokir; satu-satunya
mask adalah badge reCAPTCHA (§8.3).

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

Keluaran deterministik (jam dibekukan, tanpa acak, zona waktu aplikasi dipaksa `Asia/Jakarta` seperti
produksi — tidak bergantung `.env` lokal); dijalankan dua kali harus tanpa diff. Header berkas mencatat kelas
sumber dan commit. Di `sla.json`, `kasus` = Asia/Jakarta (produksi, acuan utama); `tambahan_utc` hanya tambahan.
