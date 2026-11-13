# UAT Slice Sxx — <nama fitur>

> Salin file ini menjadi `docs/slices/Sxx-uat.md`. Disiapkan oleh tim, dijalankan oleh pemilik proyek.
> Isi kolom **Hasil** dengan ✅ (sama/benar) atau ❌ (beda/salah), dan tulis catatan bila perlu.

| Field | Isi |
|---|---|
| Fitur | <mis. Lacak tiket & survei> |
| Versi baru (staging) | <URL staging> |
| Versi lama (pembanding) | <URL Laravel / halaman yang sama di produksi> |
| Data | salinan produksi tanggal <…>, nomor & nama di bawah adalah data uji |
| Disiapkan | <tanggal>, oleh tim |
| Dijalankan | <tanggal>, oleh pemilik proyek |

## 1. Sebelum mulai

- **Akun uji** per peran (warga, admin kawasan, super admin) sudah dibuat di staging. Nama pengguna dan cara
  mendapatkan kata sandinya diberikan terpisah — tidak ditulis di file ini.
- Buka dua jendela berdampingan: **versi baru** (staging) dan **versi lama** (pembanding).
- Coba juga di HP (atau mode ponsel di browser), karena sebagian besar warga memakai HP.

## 2. Skenario

Setiap baris: lakukan **Langkah**, isi **Data**, lalu cocokkan dengan **Yang harus terlihat** dan dengan versi lama.

| # | Peran | Langkah | Data yang diisi | Yang harus terlihat | Hasil | Catatan |
|---|---|---|---|---|---|---|
| 1 | <warga / tamu> | <buka halaman …, klik …> | <nilai persis yang diketik> | <pesan, halaman, angka yang muncul> | | |
| 2 | | | | | | |

Skenario yang selalu ada di setiap slice:

- **Alur normal**: dari awal sampai selesai, seperti pemakaian sehari-hari.
- **Isian salah**: kosongkan kolom wajib, isi format salah, unggah file terlalu besar/jenis salah → pesan
  kesalahan harus sama dengan versi lama.
- **Hak akses**: peran lain tidak boleh melihat/mengubah data yang bukan haknya.
- **Tampilan HP**: langkah utama diulang di layar ponsel.
- **Akibat ke bagian lain**: notifikasi lonceng, surel, data muncul di halaman admin/warga yang terkait.
- **Tampilan**: tidak ada beda posisi, warna, huruf, atau teks dengan versi lama.

## 3. Temuan

### Beda dengan versi lama (wajib diperbaiki sebelum pindah rute)

| # | Skenario | Apa yang beda | Tangkapan layar |
|---|---|---|---|
| | | | |

### Permintaan tambahan

Tambahan masuk `docs/backlog-pasca-cutover.md` dan dikerjakan setelah semua fitur pindah, kecuali pemilik proyek
memutuskan dikerjakan sekarang.

| # | Permintaan | Dikerjakan sekarang? (ya/nanti) |
|---|---|---|
| | | |

## 4. Keputusan pemilik proyek

- [ ] **Lulus** — boleh lanjut ke konfirmasi pindah rute.
- [ ] **Lulus dengan catatan** — boleh lanjut setelah temuan nomor … diperbaiki dan dicek ulang.
- [ ] **Tidak lulus** — perbaiki dulu, UAT diulang.

Tanggal: ……… Nama: ………
