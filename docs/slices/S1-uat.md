# UAT Slice S1 — Halaman statis publik

> Disiapkan oleh tim, dijalankan oleh pemilik proyek. Isi kolom **Hasil** dengan ✅ (sama/benar) atau ❌ (beda/salah),
> dan tulis catatan bila perlu. Tidak ada kata sandi di file ini.

| Field | Isi |
|---|---|
| Fitur | 6 halaman informasi publik (Panduan, Data Terbuka, Tentang Kami, Pedoman Layanan, Syarat & Ketentuan, Kebijakan Privasi) dan 7 alamat lama yang dialihkan |
| Versi baru (uji) | `https://cc-uji.andimohamad.my.id` (dibuka lewat Cloudflare Access: masuk dengan email Anda seperti biasa) |
| Versi lama (pembanding) | `https://app2.andimohamad.my.id`, alamat (path) yang sama |
| Data | versi uji memakai database uji sendiri (data master saja, tanpa tiket); versi lama memakai data app2 (27 tiket uji) |
| Disiapkan | 18 Nov 2026, oleh tim (QA) |
| Dijalankan | ………, oleh pemilik proyek |

## 1. Sebelum mulai

- Buka dua jendela berdampingan: kiri **versi baru** (`cc-uji…`), kanan **versi lama** (`app2…`). Di setiap langkah,
  ganti hanya bagian akhir alamat, mis. `…/panduan`.
- Pengaturan tampilan (mode gelap, aksesibilitas) disimpan **per situs**. Bila Anda mengubahnya di versi baru, ubah juga
  dengan cara yang sama di versi lama sebelum membandingkan. Di akhir UAT kembalikan ke **Terang** dan matikan semua
  pilihan aksesibilitas di kedua jendela.
- Coba juga di HP (atau mode ponsel di browser: klik kanan → *Inspect* → ikon ponsel, pilih lebar 375), karena sebagian
  besar warga memakai HP.
- **Yang wajar berbeda** (bukan temuan):
  - **Angka di halaman Data Terbuka (`/tentang`)**: database versi uji tidak berisi tiket, jadi angkanya 0 / kosong,
    sedangkan versi lama berisi 27 tiket uji. Yang dibandingkan di halaman ini adalah **susunan, judul, teks, warna, dan
    bentuk grafik**, bukan angkanya. Kesamaan angka sudah dibuktikan mesin dengan data yang sama (lihat bagian 5).
  - **Tautan ke halaman yang belum pindah** (Beranda, Lacak Tiket, Katalog, Peta, Masuk, formulir pengaduan) di versi
    uji membuka halaman "tidak ditemukan". Halaman itu dibangun di slice berikutnya. Yang dicek di UAT ini: tautannya
    ada di tempat yang sama dan menuju alamat yang sama dengan versi lama.
- **Akun uji**: warga uji (NIK `3200000000000001`) dan admin `adminuji`. Kata sandi warga diberikan terpisah; kata sandi
  admin ada di Keychain Anda (layanan `contact-center-uji`). Lihat bagian 3 tentang login.

## 2. Skenario tamu (tanpa login)

Lakukan setiap baris di **versi baru dan versi lama**, lalu bandingkan.

### 2a. Enam halaman — layar komputer, mode terang

| # | Langkah (alamat) | Yang harus terlihat, sama dengan versi lama | Hasil | Catatan |
|---|---|---|---|---|
| 1 | `/panduan` | Judul tab "Panduan Lengkap — Contact Center". Judul besar "Panduan Lengkap Contact Center", daftar isi, bagian Beranda, Chat TARA, Formulir Pengaduan, Nomor Tiket & Lacak Status, Survei Kepuasan, Masuk & Daftar Akun Warga, Portal Warga, Katalog Pengaduan, Peta Wilayah & Data Terbuka. Gambar contoh layar tampil semua | | |
| 2 | `/tentang` | Judul tab "Data Terbuka — Contact Center". Judul "Data Terbuka Contact Center", kartu angka, bagian Status penanganan, Top kategori keluhan, Distribusi kanal pengaduan, Provinsi dengan pengaduan terbanyak, dasar hukum di bawah. (Angka boleh beda — lihat bagian 1) | | |
| 3 | `/tentang-kami` | Judul tab "Tentang Kami — Contact Center". Bagian Sekilas Contact Center, Unit Pengelola, Kontak Resmi | | |
| 4 | `/pedoman-layanan` | Judul tab "Pedoman Layanan — Contact Center". Bagian Alur Penanganan Pengaduan, Kanal Pengaduan Resmi, Standar Waktu Layanan (SLA), Hak Pelapor, Kewajiban Pelapor | | |
| 5 | `/syarat-ketentuan` | Judul tab "Syarat dan Ketentuan — Contact Center". Pasal 1–7 (Ketentuan Umum s.d. Hukum yang Berlaku) | | |
| 6 | `/kebijakan-privasi` | Judul tab "Kebijakan Privasi — Contact Center". Pasal 1–7 (Dasar Hukum s.d. Hak Anda atas Data Pribadi) | | |
| 7 | Di setiap halaman di atas: lihat **bagian atas** (header) | Logo + "Kementerian Transmigrasi", menu Beranda · Lacak Tiket · Katalog Pengaduan · Peta Wilayah · Data · Panduan, tombol bulan/matahari (mode gelap), tombol **Masuk**. Menu halaman yang sedang dibuka disorot sama | | |
| 8 | Di setiap halaman: gulir ke **paling bawah** (footer) | Isi, tautan, dan tahun sama | | |
| 9 | Di `/panduan`: klik beberapa entri daftar isi | Halaman melompat ke bagian yang sama seperti versi lama | | |
| 10 | Di setiap halaman: tombol bulat **TARA** (kanan bawah) dan tombol **Aksesibilitas** (tab di tepi kiri) | Ada di posisi yang sama | | |

### 2b. Mode gelap & aksesibilitas

| # | Langkah | Yang harus terlihat | Hasil | Catatan |
|---|---|---|---|---|
| 11 | Di `/panduan`, klik tombol bulan (☾) di header | Seluruh halaman berganti gelap; warna latar, teks, kartu sama dengan versi lama dalam mode gelap | | |
| 12 | Dengan mode gelap aktif, buka lima halaman lain satu per satu | Tetap gelap, tampilan sama dengan versi lama | | |
| 13 | Klik matahari (☀) untuk kembali terang. Buka panel **Aksesibilitas** (tab kiri), pilih ukuran **A++**, nyalakan **Kontras tinggi** dan **Huruf mudah dibaca** | Teks membesar, warna hitam-putih-kuning, huruf berganti — sama dengan versi lama dengan pilihan yang sama | | |
| 14 | Dengan pilihan nomor 13, buka keenam halaman | Tidak ada teks terpotong atau tumpang-tindih yang tidak ada di versi lama | | |
| 15 | Di panel Aksesibilitas, klik tombol atur ulang / kembalikan semua ke awal; pilih tema **Terang** | Tampilan kembali normal | | |

### 2c. Tampilan HP (lebar 375)

| # | Langkah | Yang harus terlihat | Hasil | Catatan |
|---|---|---|---|---|
| 16 | Buka keenam halaman di HP / mode ponsel | Susunan satu kolom, ukuran huruf, gambar, dan jarak sama dengan versi lama; tidak bisa digeser ke samping (kecuali bila versi lama juga bisa) | | |
| 17 | Ketuk tombol menu (☰) di header | Menu ponsel terbuka dengan daftar yang sama; ketuk lagi untuk menutup | | |
| 18 | Tombol Aksesibilitas | Di HP berupa tombol bulat kiri bawah, TARA di kanan bawah — sama dengan versi lama | | |
| 19 | Ulangi nomor 11 (mode gelap) dan 13 (aksesibilitas) di HP | Sama dengan versi lama | | |

### 2d. Alamat lama yang dialihkan

Ketik alamat di kolom alamat browser, tekan Enter, lalu lihat alamat yang **akhirnya** tampil. Di versi uji halaman
tujuan masih "tidak ditemukan" (belum pindah); yang dicek hanya **alamat tujuannya**.

| # | Ketik alamat | Alamat akhir harus | Hasil | Catatan |
|---|---|---|---|---|
| 20 | `/beranda-baru` | `/` | | |
| 21 | `/beranda-lama` | `/` | | |
| 22 | `/beranda-standar` | `/` | | |
| 23 | `/beranda-absol` | `/` | | |
| 24 | `/katalog/kantor-balai` | `/katalog` | | |
| 25 | `/lacak-tiket?ticket=TKT-260101-ABCDEF` | `/lacak` (bagian `?ticket=…` hilang, sama dengan versi lama) | | |
| 26 | `/pengaduan` | `/pengaduan/baru` | | |
| 27 | `/panduan/` (dengan garis miring di akhir) | Tetap halaman Panduan, tidak dialihkan | | |

## 3. Skenario warga & admin (login)

**Keadaan saat ini:** halaman **Masuk** baru dibangun di slice S15, jadi di versi uji belum ada formulir login. Saat
login, satu-satunya yang berubah di keenam halaman S1 adalah **tombol kanan atas** di header: tamu melihat "Masuk",
warga melihat **"Portal Saya"**, admin melihat **"Panel Admin"** (di HP admin juga sedikit lebih lebar, sama dengan
versi lama).

Usul kami (pilih salah satu di bagian 6):

- **A. Dicukupkan dengan bukti mesin (disarankan).** Suite paritas login sebagai warga uji dan admin uji, lalu
  membandingkan keenam halaman × 3 ukuran layar dengan versi lama: harus **0 piksel berbeda** dan struktur halaman
  sama (lihat bagian 5). Pemilik proyek mengecek header saat login nanti di UAT S15, ketika formulir Masuk sudah ada.
- **B. Cek sendiri sekarang lewat konsol browser (opsional, sementara sampai S15).** Langkah ini memakai kata sandi
  Anda sendiri dan tidak menyimpan apa pun selain cookie login di browser Anda:
  1. Di versi uji buka `/panduan`, tekan `F12` → tab **Console**.
  2. Tempel baris di bawah, ganti `ISI_NIK_ATAU_USERNAME` dan `ISI_SANDI` (tetap di antara tanda kutip), Enter:

     ```js
     fetch('/masuk', { method: 'POST', headers: { 'X-XSRF-TOKEN': decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)[1]) }, body: new URLSearchParams({ identifier: 'ISI_NIK_ATAU_USERNAME', password: 'ISI_SANDI' }) }).then((r) => location.reload())
     ```

  3. Halaman dimuat ulang; tombol kanan atas harus berubah menjadi "Portal Saya" (warga) atau "Panel Admin" (admin).
     Bila tetap "Masuk", login gagal (sandi salah atau terlalu sering mencoba) — tidak perlu diulang berkali-kali.
  4. Untuk keluar: tutup jendela penyamaran, atau hapus cookie situs `cc-uji…` (ikon gembok di kolom alamat →
     *Cookies* → hapus). Lakukan langkah ini di **jendela penyamaran** agar tidak tercampur dengan jendela lain.
  5. Di versi lama, login lewat halaman `/masuk` seperti biasa dengan akun pembanding yang setara.

| # | Peran | Langkah | Yang harus terlihat | Hasil | Catatan |
|---|---|---|---|---|---|
| 28 | warga (NIK `3200000000000001`) | Login (cara A atau B), buka keenam halaman | Tombol kanan atas "Portal Saya" (menuju `/portal-warga`), selebihnya sama dengan tamu | | |
| 29 | admin `adminuji` | Login (cara A atau B), buka keenam halaman, juga di HP | Tombol kanan atas "Panel Admin" (menuju `/admin`); di HP header admin sama dengan versi lama | | |

## 4. Temuan

### Beda dengan versi lama (wajib diperbaiki sebelum lanjut)

| # | Skenario | Apa yang beda | Tangkapan layar |
|---|---|---|---|
| | | | |

### Permintaan tambahan

Tambahan masuk `docs/backlog-pasca-cutover.md` dan dikerjakan setelah semua fitur pindah, kecuali pemilik proyek
memutuskan dikerjakan sekarang.

| # | Permintaan | Dikerjakan sekarang? (ya/nanti) |
|---|---|---|
| | | |

## 5. Bukti mesin (sudah dijalankan tim, tidak perlu diulang)

Suite `parity/` di laptop pengembang, Laravel (`laravel-baseline`) dan Next.js memakai **data uji yang sama**:

- Tampilan: 6 halaman × 3 ukuran layar (komputer 1440, tablet 768, HP 375) × terang / gelap / aksesibilitas / login
  warga / login admin, plus header login warga & admin = **96 test (186 berkas pembanding)**, toleransi **0 piksel**, dan struktur
  halaman (HTML header/isi/footer) harus sama persis.
- Perilaku: status 200, judul tab, deskripsi, judul bagian, header keamanan, cookie, dan **17** variasi alamat lama yang
  dialihkan (301, alamat tujuan persis).
- Hasil terakhir dicatat di laporan QA S1 (lihat `docs/slices/S1.md`, "Perbedaan yang disengaja" untuk dua hal teknis
  yang memang berbeda dan tidak terlihat di layar: nama cookie login dan alamat koneksi realtime).

## 6. Keputusan pemilik proyek

Cara cek login (bagian 3): [ ] A — bukti mesin, dicek ulang di UAT S15   [ ] B — sudah saya cek sendiri

- [ ] **Lulus** — S1 boleh ditutup.
- [ ] **Lulus dengan catatan** — boleh ditutup setelah temuan nomor … diperbaiki dan dicek ulang.
- [ ] **Tidak lulus** — perbaiki dulu, UAT diulang.

Tanggal: ……… Nama: ………
