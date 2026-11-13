# Rencana Dokumentasi Fitur SIGAP (PDF)

Disusun 25 Oktober 2026. Keluaran: `docs/dokumentasi/SIGAP-Dokumentasi-Fitur.pdf` (A4, tegak).

## Tujuan
Satu dokumen rapi yang menjelaskan **semua fitur SIGAP**, untuk siapa, dan bagaimana
alurnya, dilengkapi tangkapan layar aplikasi asli. Bagian penting di gambar diberi
**bingkai merah**. Dokumen juga memuat use case end-to-end (Pak Darto & petugas Rina,
Pak Hendra, dan lainnya) serta jawaban "Kan sudah ada SP4N-LAPOR!".

## Format & tata letak
- A4 tegak, margin 20 mm (atas/bawah) × 18 mm (kiri/kanan); nomor halaman di kaki.
- Huruf: Space Grotesk (judul), Inter (isi), JetBrains Mono (kode/rute).
- Warna mengikuti Admin v2: navy `#003D68`, emas `#C29642`.
- Tabel: kepala abu muda, garis tipis, padding sel 8–10 px, lebar kolom tetap.
- Gambar: lebar penuh kolom, bingkai abu tipis, keterangan "Gambar n. …" di bawahnya;
  sorotan = bingkai merah `#E11D48` + nomor penanda bila lebih dari satu sorotan.
- Setiap bab mulai di halaman baru; gambar tidak terpotong antarhalaman.

## Susunan isi
1. **Sampul** — judul, subjudul, versi, tanggal.
2. **Daftar isi.**
3. **Ringkasan** — SIGAP dalam satu halaman: masalah, solusi, angka kunci.
4. **Latar belakang, masalah, solusi** — dari dokumen sebelumnya (tabel 9 masalah → 9 solusi).
5. **Peran pengguna** — Warga/Tamu, Pegawai internal, Admin Kawasan, Super Admin, Asisten TRANSI (tabel hak akses).
6. **Peta fitur** — tabel semua fitur + rute + peran.
7. **Fitur untuk warga** (dengan gambar & sorotan):
   - Beranda TRANSI & tombol "Coba Desain Baru"
   - Chat TRANSI layar penuh: tamu tanpa akun, jawaban bersumber, kartu portal, lanjut di perangkat lain, lampiran foto, kartu konfirmasi data, akhiri & unduh transkrip
   - Katalog pengaduan, formulir pengaduan, pengaduan internal pegawai
   - Lacak tiket, halaman pengantar rujukan
   - Akun warga: daftar, masuk, verifikasi email, lupa/atur ulang sandi, aktivasi akun dari chat, Portal Warga
   - Panduan, pedoman layanan, peta aduan, halaman statis
8. **Fitur panel admin (Admin v2)**:
   - Tata letak baru (sidebar, topbar, notifikasi)
   - Matriks Rekapan (EWS, SLA, filter, cetak)
   - Manajemen Tiket & detail tiket
   - Tiket Internal, Input Manual
   - Pesan Masuk (contact center): tab antrean, ambil percakapan, ringkasan AI, daftarkan akun, pemulihan sandi, konfirmasi data, terbitkan tiket, rujuk portal/Inspektorat
   - Rujukan (pendampingan sampai berhasil)
   - Basis Pengetahuan, tinjau berurutan, buat dari dokumen, **Sumber Resmi**
   - Katalog Portal (cek kesehatan tiap jam)
   - Daftar Admin, Log Aktivitas, Data Kawasan, Manajemen Kanal, Pengaturan
9. **Asisten AI TRANSI** — alur jawaban, sumber artikel vs kutipan, sumber berbeda (contoh batas usia), pertanyaan pribadi, aduan → petugas, konfigurasi Sumopod.
10. **Use case end-to-end**:
    - A. Pak Darto ingin ikut transmigrasi, didampingi petugas Rina (rujukan SIBARDUKTRANS sampai berhasil)
    - B. Pak Hendra: internet lantai 3 mati (pengaduan internal)
    - C. Bu Sri bertanya batas usia: sumber resmi berbeda
    - D. Warga melapor jalan rusak lewat chat → tiket → SLA/EWS → selesai + survei
    - E. Laporan dari Instagram dicatat lewat Input Manual
11. **Posisi terhadap SP4N-LAPOR!** — jawaban singkat, lengkap, tabel pembeda, hal yang jangan diklaim.
12. **Keamanan & privasi** — PII disamarkan, NIK hash, EXIF dibuang, reCAPTCHA, batas laju, audit log, domain resmi.
13. **Status & tindak lanjut** — yang sudah jalan, yang perlu disiapkan (AI key server, SMTP, deploy, integrasi SP4N, unit kerja), temuan data (19–53 vs 19–49).
14. **Lampiran** — daftar rute, glosarium.

## Cara pembuatan
1. Tangkapan layar diambil otomatis dari aplikasi lokal (Playwright + Chrome, 1440 px untuk desktop, 390 px untuk ponsel) dengan data demo lokal.
2. Sorotan dibuat dengan menyisipkan bingkai merah pada elemen yang dimaksud sebelum gambar diambil.
3. Percakapan contoh di chat memakai AI asli (Sumopod) agar jawabannya nyata.
4. Dokumen ditulis sebagai HTML lalu dicetak ke PDF dengan Chrome (ukuran A4, margin di atas).
5. Diperiksa per halaman: tidak ada teks/gambar terpotong, tabel rapi, nomor gambar berurutan.
