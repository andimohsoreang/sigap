# Suite paritas Contact Center

Membuktikan Next.js berperilaku dan tampil **identik** dengan Laravel (tag `laravel-baseline`).
Aturan visual: `docs/RENCANA-REWRITE-NEXTJS.md` §8.3 (`maxDiffPixels: 0`, `threshold: 0`, mask hanya badge reCAPTCHA,
capture selebar viewport — lihat *Pengecualian* di bawah).

| Berkas | Isi |
|---|---|
| `tests/http.spec.ts` | halaman S1 (+ garis miring akhir) → 200 tanpa redirect, judul, meta, `lang="id"`, h1/h2, header tamu, request & WebSocket luar yang diblokir; `Cache-Control: no-cache, private`, header keamanan, CSP per direktif, atribut cookie `sigap_session`/`XSRF-TOKEN`; redirect lama → 301 + `Location` persis (relatif, query dibuang) |
| `tests/visual.spec.ts` | S1 × desktop 1440 / tablet 768 / ponsel 375 × varian terang, gelap, aksesibilitas (teks 130% + kontras + disleksia), login warga, login admin: screenshot full page + snapshot DOM `<header>`/`<main>`/`<footer>` ternormalisasi (ukuran gulir & daftar luapan di komentar awal); header terpisah untuk varian login |
| `tests/login.setup.ts` | login akun uji `sigap:e2e-setup` → `.auth/*.json` |
| `env/laravel.env` | konfigurasi target Laravel = cermin produksi (`PRODUKSI.md`), tanpa rahasia |
| `visual/manifest.json` | SHA-256 tiap baseline Laravel per `<platform>-<arch>` (mis. `darwin-arm64`, CI `linux-x64`) + sidik mesin (CPU, fitur SIMD) & versi Playwright/Chromium (PNG tidak di-commit) |
| `fixtures/` | vektor JSON dari kelas PHP asli (`cc:ekspor-fixture`); `fixtures/kripto/` milik paket B |

## Persiapan (sekali)

- PostgreSQL lokal: database `cc_paritas` di `127.0.0.1:5432`, pemilik `cc_migrate` (trust), `LC_COLLATE 'C'`,
  zona UTC — meniru urutan & zona produksi (`PRODUKSI.md`).
- `sigap/`: `composer install && npm ci`. `sigap/.env` tidak diperlukan.
- `parity/`: `npm ci && npx playwright install chromium`.

`scripts/laravel.sh` (dipanggil Playwright bila `BASE_URL` kosong) menolak jalan bila `sigap/` berbeda dari tag
`laravel-baseline` (kecuali `app/Console/Commands/Cc` & `README.md`) atau `sigap/public/hot` ada; lalu memuat
`env/laravel.env`, membuat `APP_KEY`/`NIK_HASH_KEY` acak, `vite build`, `config:clear`, `sigap:e2e-setup`
(`migrate:fresh --seed` di `cc_paritas`), dan `php artisan serve` di `127.0.0.1:8124`. Semua request ke origin
selain `BASE_URL` diblokir dan dicatat.

## Alur

1. **Baseline Laravel** (di mesin yang sama dengan pembandingan):

   ```bash
   npm run baseline
   ```

   Menulis `.baseline/<platform>-<arch>/` (diabaikan git) dengan `--update-snapshots=all`, menjalankan Laravel kedua kali
   (DB & kunci baru) dan harus 0 piksel/0 byte beda (ketat, di mesin mana pun), lalu mencocokkan dengan
   `visual/manifest.json`. Platform baru, atau tampilan Laravel memang berubah: `npm run baseline -- tulis`, lalu commit
   `visual/manifest.json`.

   **Hash hanya dicek di mesin yang sama.** Chromium merasterisasi di CPU lewat Skia, yang memilih jalur SIMD
   (AVX2/AVX-512, NEON) sesuai prosesor; antialias tepi bisa beda ±1 nilai warna antar-mesin, walau di satu mesin
   selalu identik (terbukti di CI: runner GitHub berbeda CPU → 10/186 hash `linux-x64` beda, dua boot di job yang sama
   tetap 0 beda). Karena itu entri manifest menyimpan sidik mesin (model CPU, fitur SIMD dari `/proc/cpuinfo` atau
   `sysctl`, versi Playwright & Chromium). Sidik sama → nama **dan** hash dicek; sidik beda → hanya daftar nama berkas,
   dengan pesan "mesin berbeda: …". Paritas Laravel↔Next tidak terpengaruh: keduanya selalu dibandingkan di mesin &
   job yang sama. Perlindungan terhadap perubahan Laravel diam-diam tetap dari penjaga `git diff laravel-baseline` di
   `scripts/laravel.sh` (target menolak jalan bila `sigap/` beda dari tag).

2. **Laravel (cek ulang suite)**: `npx playwright test`.

3. **Next.js**: `BASE_URL=http://127.0.0.1:3000 npx playwright test` — dibandingkan dengan `.baseline/` dari langkah 1.
   - Jalankan build produksi: `next build && next start` (bukan `next dev`: indikator dev & overlay mengubah piksel/DOM).
   - Data sama dengan Laravel: seed `sigap:e2e-setup` ke database target, berkas kredensial
     `sigap/storage/app/e2e/credentials.json` atau `CREDENTIALS=<path>`.
   - Jam server **tidak** dibekukan (hanya jam browser): seed dan jalankan pada hari yang sama dengan baseline,
     karena penghitung "Laporan masuk hari ini" di `/tentang` dihitung dari jam server.
   - Baseline tidak pernah ditulis dari target lain (`updateSnapshots: 'none'`). Selisih ada di `test-results/`
     (expected/actual/diff); `npx playwright show-report`.

Jangan menambah toleransi atau mask untuk meloloskan test.

## Pengecualian: capture selebar viewport

Disetujui pemilik proyek dan dicatat di §8.3. Screenshot full page dipotong selebar viewport, karena Chromium
merasterisasi konten di luar viewport secara tidak deterministik (±1 nilai warna pada ~2% muatan). Luapan tetap
dibandingkan: tiap snapshot DOM diawali `<!-- gulir LxT -->` dan satu baris `<!-- luap: <selector> kiri–kanan -->`
per elemen terluar (atau teks) yang keluar viewport. Kotak ≤ 2 px (sr-only) dan isi wadah ber-overflow non-visible
diabaikan. Di Laravel saat ini ada 8 snapshot berluapan, semuanya di ponsel 375 px:

- varian admin × 6 halaman: `header div:nth-of-type(1) > div 217.9–379.6` (tombol "Panel Admin" + menu, gulir 380 px);
- aksesibilitas `/panduan`: teks langkah panduan sampai 392.9 (gulir 393 px);
- aksesibilitas `/tentang`: dua kartu bagian ketiga sampai 378.8 (gulir 379 px).

## Fixtures

```bash
cd sigap && php artisan cc:ekspor-fixture        # menulis ../parity/fixtures/*.json
```

Berjalan di skema sementara `cc_fixture` pada `cc_paritas` (dibuat & dihapus; `--db`, `--db-user`), jam dibekukan,
zona waktu dipaksa `Asia/Jakarta` seperti produksi; dijalankan dua kali harus tanpa diff. Header berkas memuat kelas
sumber dan `commit` = `git rev-parse laravel-baseline`.

| Berkas | Isi |
|---|---|
| `sla.json` | `dueAt`/`respondAt`/`resolveDays` + `tersimpan_db` (nilai kolom Eloquent) per dampak × `sla_days` × waktu mulai (termasuk pecahan detik, akhir pekan, batas bulan/tahun); `status` SLA |
| `status-tiket.json` | matriks transisi + `TicketService::changeStatus` sungguhan per pasangan × varian (kolom hasil, riwayat, galat) |
| `nomor-tiket.json` | pola, alfabet, normalisasi (`normalizeNo`/`isValidNo`/`isLegacyNo`, NBSP, `\0`, `\x0B`, `ſ`), kode akses, prefiks nomor baru (WIB) |
| `lacak-tiket.json` | `findForPublicLookup` per jenis tiket × penampil × kode; jalur HTTP `/lacak` (TrimStrings + `?kode=`) |
| `survei-skm.json` | indeks & mutu SKM, alasan tinjau ulang lewat `SurveyService::submit` (termasuk nilai string dari form) |
