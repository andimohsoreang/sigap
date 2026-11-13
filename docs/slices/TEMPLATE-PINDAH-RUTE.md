# Konfirmasi Pindah Rute — Slice Sxx

> Pesan ini dikirim orkestrator ke pemilik proyek sebelum fitur dipindah ke sistem baru. Bahasanya sederhana,
> tanpa istilah teknis. Rute **tidak** dipindah sebelum ada jawaban "Setuju".

---

**Fitur yang akan dipindah:** <nama fitur, mis. "Lacak tiket & survei kepuasan">

**Halaman yang terdampak:** <daftar alamat, mis. `/lacak`, `/lacak/{nomor}`, `/lacak/{nomor}/survei`>

**Apa yang berubah untuk pengguna:** Tidak ada. Tampilan dan cara kerjanya sama persis; yang berganti hanya sistem
di belakangnya.

**Sudah dicek:**

| Pemeriksaan | Hasil |
|---|---|
| Uji otomatis (perilaku sama dengan versi lama) | <N> dari <N> lulus |
| Tampilan sama persis | <N> layar (HP, tablet, komputer; terang/gelap) — 0 beda |
| Pemeriksaan keamanan | <0 masalah serius / ringkasan singkat> |
| Uji beban | <mis. kuat <X> pengunjung bersamaan, target <Y>> |
| UAT oleh Anda | <Lulus / Lulus dengan catatan>, tanggal <…> |

**Kapan dipindah:** <hari, tanggal, jam> — di luar jam sibuk.

**Kalau ada masalah:** fitur dikembalikan ke sistem lama dalam waktu kurang dari 1 menit. Data tidak hilang dan
tetap terbaca oleh kedua sistem.

**Risiko yang masih ada:** <satu atau dua kalimat, atau "tidak ada yang diketahui">

**Setelah dipindah:** dipantau 3 hari kerja. Anda akan menerima laporan singkat di akhir masa pantau.

---

Balas dengan salah satu:

- **"Setuju pindah Sxx"** — dipindah sesuai jadwal di atas.
- **"Setuju pindah Sxx, jadwal <tanggal/jam lain>"**
- **"Tunda"** — beri tahu alasannya bila ada.
