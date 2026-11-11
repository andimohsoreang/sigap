# PRD — Master Unit Kerja & Disposisi Pengaduan

| | |
|---|---|
| Versi | 1.0 — disetujui pemilik 11-11-2026 (K1–K7 memakai saran), belum dikerjakan |
| Tanggal | 11 November 2026 |
| Lingkup | Master data Unit Kerja; disposisi tiket oleh Super Admin ke unit; peran Petugas Unit |
| Dokumen terkait | `PRD.md`, `TECH-SPEC.md` (SEC-07), `PRD-AI.md` (batas modul, aturan §0) |

> Asumsi: yang dimaksud adalah **pengaduan** (tiket SIGAP) yang didisposisikan ke unit kerja,
> bukan pengadaan barang/jasa.

---

## 0. Aturan kerja

1. Migrasi **hanya menambah** tabel/kolom (aturan proyek). Kolom teks lama (`users.unit`,
   `tickets.reporter_unit`) tetap ada.
2. Tidak ada perubahan perilaku untuk warga, TARA, dan petugas Contact Center sampai fase yang
   menyebutnya.
3. Setiap fase: tes lama hijau tanpa diubah (bila harus diubah, berhenti dan tanya), Pint,
   Prettier, ESLint, tsc, Vitest, backup DB sebelum migrasi, tag image per SHA, deploy.
4. Repo publik: tidak ada data pribadi, kredensial, atau isi `.env` di repo/log/chat.

## 1. Kondisi sekarang (dari kode, 11-11-2026)

| Temuan | Lokasi | Dampak |
|---|---|---|
| Unit petugas berupa **teks bebas** | `users.unit` (string 120) | Tidak bisa dipakai untuk menyaring tiket per unit |
| Daftar unit formulir internal **ditulis tetap di kode**, sebagian nama lama era Kemendes ("Ditjen PKP2Trans", "Ditjen PKTrans") | `PengaduanFormController::createInternal` | Nama unit tidak sesuai struktur Perpres 172/2024 |
| **Tidak ada disposisi.** Penanggung jawab tiket = admin pertama yang mengubah status | `TicketService::changeStatus` (baris ±125) | Tidak ada yang "ditugaskan"; siapa cepat dia dapat |
| Admin Kawasan melihat **semua** tiket publik (sejak 31-10-2026); tiket internal hanya Super Admin | `Ticket::scopeVisibleTo` | Belum ada pembatasan per unit |
| Kolom `role` berupa string(20) | migrasi users | Peran baru `admin_unit` muat tanpa migrasi ubah kolom |

Struktur organisasi resmi (Permentrans 11/2025 Renstra, merujuk Perpres 172/2024): Sekretariat
Jenderal; Ditjen Pembangunan dan Pengembangan Kawasan Transmigrasi (PPKTrans); Ditjen
Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi; Inspektorat Jenderal; Pusat
Pengembangan SDM beserta UPT. Eselon II Ditjen PPKTrans tercantum di Renstra Ditjen PPKTrans
2025–2029.

## 2. Tujuan

| ID | Tujuan |
|---|---|
| G1 | Super Admin mengelola **master Unit Kerja** (tambah, ubah, nonaktifkan, susunan induk–anak). |
| G2 | Super Admin **mendisposisikan** setiap tiket ke satu unit, dengan catatan dan tenggat. |
| G3 | Petugas unit **hanya melihat tiket unitnya**, menerima, memproses, membalas warga, atau mengembalikan bila salah unit. |
| G4 | Tidak ada tiket yang "menggantung": tiket belum didisposisi, dikembalikan, atau lewat tenggat selalu terlihat di antrean Super Admin. |
| G5 | Kinerja per unit terukur di Matriks (jumlah, waktu terima, waktu selesai, lewat SLA). |

**Bukan tujuan (fase ini):** beberapa unit sekaligus per tiket (unit pendukung), alur
persetujuan berjenjang, disposisi otomatis oleh AI, integrasi e-Office/TNDE.

## 3. Peran

| Peran | Sekarang | Setelah fitur |
|---|---|---|
| Super Admin | Semua | + kelola Unit Kerja, disposisi, tarik/alihkan disposisi |
| Admin Kawasan (Contact Center) | Chat, tiket publik | **Tidak berubah** |
| **Petugas Unit** (`admin_unit`, baru) | — | Hanya menu *Tiket Unit*: tiket yang didisposisikan ke unitnya |
| Pegawai / Warga | Formulir & lacak | Lacak menampilkan nama unit penangan (K4) |

Petugas Unit **tidak** mengakses chat, Basis Pengetahuan, master data, atau tiket unit lain.

## 4. Alur

```
Tiket masuk (warga / pegawai / TARA / kanal)
        │
        ▼
Antrean Super Admin: "Belum didisposisi"
        │  pilih unit (saran dari kategori), catatan, tenggat (default dari SLA kategori)
        ▼
DISPOSISI ──► notifikasi lonceng + surel ke Petugas Unit aktif
        │
        ▼
Petugas Unit: [Terima] ──► jadi penanggung jawab (assignee)
        │                     │
        │                     ├─ balas warga, ubah status (Diproses → Selesai)
        │                     └─ selesai ──► warga diminta survei (sudah ada)
        │
        └─ [Kembalikan] + alasan ("bukan kewenangan unit kami")
                 ──► kembali ke antrean Super Admin "Dikembalikan"

Tenggat lewat / tidak diterima 1 hari kerja ──► EWS ke Petugas Unit + Super Admin
Super Admin bisa [Tarik] atau [Alihkan] disposisi kapan saja (tercatat).
```

Satu langkah berikutnya per layar (pola halaman Rujukan): tiap tiket hanya menampilkan
tombol yang relevan dengan statusnya.

## 5. Data (migrasi tambah saja)

**`units`**

| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint | |
| code | string(30) unik | mis. `SETJEN`, `DITJEN-PPKTRANS` |
| name | string(200) | nama resmi |
| short_name | string(60) null | untuk tampilan ringkas |
| parent_id | FK units null | induk (Eselon I → Eselon II) |
| level | string(20) | `eselon_1`, `eselon_2`, `upt`, `lainnya` |
| email | string null | surel unit (opsional, untuk notifikasi) |
| is_active | bool | unit nonaktif tidak bisa dipilih, data lama tetap |
| sort | int | |

**Kolom baru**

| Tabel | Kolom | Catatan |
|---|---|---|
| users | `unit_id` FK null | wajib untuk `admin_unit`; `unit` teks tetap ada |
| tickets | `unit_id` FK null | unit penangan **saat ini** (untuk penyaringan cepat) |
| tickets | `disposed_at` timestamp null | |
| tickets | `reporter_unit_id` FK null | unit asal pelapor internal (beda dari unit penangan) |
| categories | `default_unit_id` FK null | saran unit saat disposisi |

**`ticket_dispositions`** (riwayat; satu baris per disposisi)

| Kolom | Catatan |
|---|---|
| ticket_id, unit_id | |
| assigned_by | Super Admin yang mendisposisi |
| accepted_by null | Petugas Unit yang menerima |
| note | instruksi Super Admin |
| due_at | tenggat |
| status | `menunggu`, `diterima`, `dikembalikan`, `ditarik`, `selesai` |
| accepted_at, closed_at | |
| return_reason null | wajib bila dikembalikan |

Indeks: `(unit_id, status)`, `(ticket_id, created_at)`. Hanya satu disposisi berstatus
`menunggu`/`diterima` per tiket (dijaga di service dalam transaksi + kunci baris).

## 6. Hak akses

| Aksi | Super Admin | Admin Kawasan | Petugas Unit |
|---|---|---|---|
| Kelola Unit Kerja | ✅ | ❌ | ❌ |
| Disposisi / tarik / alihkan | ✅ | ❌ (K2) | ❌ |
| Lihat tiket | semua | publik (tetap) | **hanya `tickets.unit_id` = unitnya** |
| Terima / kembalikan | ✅ | ❌ | ✅ (tiket unitnya) |
| Balas warga, ubah status | ✅ | ✅ (tetap) | ✅ (setelah diterima) |
| Chat, Basis Pengetahuan, master data | ✅ | sesuai sekarang | ❌ |

- `Ticket::scopeVisibleTo` mendapat cabang `admin_unit`; Petugas Unit **tanpa** `unit_id`
  tidak melihat apa pun (pola A-05).
- `UserRole::isAdmin()` **tidak** diubah agar Petugas Unit tidak otomatis mendapat akses panel
  Contact Center; buat `isUnitStaff()` dan middleware/route grup sendiri.
- NIK pelapor tetap tersamar untuk Petugas Unit; kontak pelapor tampil seperti untuk admin.
- Tes Ziggy per peran: rute admin tidak bocor ke Petugas Unit.
- Auto-assign lama ("admin pertama yang mengubah status") **tidak berlaku** untuk tiket yang
  sudah didisposisi; penanggung jawabnya = yang menekan **Terima**.

## 7. Layar

| Layar | Untuk | Isi |
|---|---|---|
| Master Data → **Unit Kerja** | Super Admin | Tabel berstruktur induk–anak; tambah/ubah/nonaktifkan; kolom jumlah petugas & tiket aktif; tidak bisa dihapus bila sudah dipakai |
| Daftar Petugas | Super Admin | Peran **Petugas Unit** + pilihan Unit Kerja (wajib) |
| Kategori | Super Admin | Kolom **Unit default** |
| Detail tiket → panel **Disposisi** | Super Admin | Unit (terisi saran kategori), catatan, tenggat → *Disposisikan*; riwayat disposisi; *Tarik* / *Alihkan* |
| Daftar tiket | Super Admin | Saringan cepat: *Belum didisposisi*, *Dikembalikan*, *Lewat tenggat*, per unit |
| **Tiket Unit** | Petugas Unit | Tab *Baru* (perlu diterima) · *Diproses* · *Selesai*; detail dengan *Terima*, *Balas*, *Ubah status*, *Kembalikan* |
| Formulir internal | Pegawai | Daftar unit dari master (aktif), simpan `reporter_unit_id` + teks |
| Lacak | Warga | "Ditangani oleh: *nama unit*" (bukan nama petugas) |
| Matriks | Super Admin | Kinerja per unit |

## 8. Notifikasi & audit

- Disposisi baru → lonceng (Reverb kanal privat `user.{id}`) + surel ke Petugas Unit aktif
  unit itu; bila tidak ada petugas aktif → peringatan ke Super Admin saat disposisi.
- Dikembalikan / lewat tenggat / tidak diterima 1 hari kerja → Super Admin (pakai `sigap:ews-check`).
- Audit log: `unit.created|updated|deactivated`, `ticket.disposed|accepted|returned|withdrawn|redirected`.
- Riwayat tiket (`ticket_histories`) mencatat disposisi agar terlihat di linimasa tiket.

## 9. Data awal & migrasi data

1. **Seeder Unit Kerja** dari dokumen resmi: Eselon I (Setjen, Ditjen PPKTrans, Ditjen
   Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi, Itjen, Pusat Pengembangan
   SDM) dan Eselon II Ditjen PPKTrans dari Renstra. Unit lain dilengkapi Super Admin.
   Setiap entri mencantumkan sumbernya di komentar seeder. `firstOrCreate` per `code`.
2. `users.unit` teks → `unit_id` hanya bila nama **sama persis**; sisanya dilaporkan, tidak ditebak.
3. Nama lama di formulir internal ("Ditjen PKP2Trans", "Ditjen PKTrans", "Biro Umum & TIK")
   **tidak** dipetakan otomatis; tiket lama tetap menyimpan teksnya.
4. Tiket terbuka yang sudah ada: `unit_id` kosong (K5).

## 10. Tahapan

| Fase | Isi | Terlihat oleh | Perkiraan |
|---|---|---|---|
| **F1** Master Unit ✅ | Tabel `units`, seeder, halaman Unit Kerja, `users.unit_id` di Daftar Petugas, formulir internal dari master, `reporter_unit_id` | Super Admin, pegawai | 1–2 hari |
| **F2** Disposisi | `ticket_dispositions`, `tickets.unit_id`, panel Disposisi, saringan antrean, riwayat, audit, lacak menampilkan unit | Super Admin, warga | 2 hari |
| **F3** Petugas Unit | Peran `admin_unit`, scope, menu *Tiket Unit*, Terima/Kembalikan, notifikasi | Petugas Unit | 2–3 hari |
| **F4** Kendali | Tenggat & EWS per disposisi, unit default per kategori, Matriks per unit | Super Admin | 1–2 hari |
| F5 (opsional) | Saran unit oleh AI (perluasan `TicketSuggester`), Eselon I melihat tiket unit turunannya, unit pendukung | — | nanti |

Tiap fase dideploy terpisah dan bisa dipakai sendiri.

## 11. Tes

- Unit: scope per peran (Super Admin / Admin Kawasan / Petugas Unit dengan & tanpa unit),
  satu disposisi aktif per tiket, transisi status disposisi yang sah saja.
- Feature: disposisi → notifikasi → terima → balas → selesai; kembalikan wajib alasan;
  Petugas Unit tidak bisa membuka tiket unit lain (404, bukan 403, agar tidak membocorkan
  keberadaan); unit nonaktif tidak bisa dipilih; unit terpakai tidak bisa dihapus.
- Ziggy per peran; tes arsitektur batas modul tetap hijau.
- E2E Playwright: alur Super Admin mendisposisi → Petugas Unit menerima → warga melihat unit di lacak.

## 12. Kriteria selesai

1. Super Admin dapat membuat unit dan petugasnya, lalu mendisposisikan tiket dalam ≤ 3 klik
   dari detail tiket.
2. Petugas Unit hanya melihat tiket unitnya (diuji), dan tidak melihat menu selain *Tiket Unit*.
3. Setiap tiket terbuka berada di salah satu: belum didisposisi, menunggu diterima,
   diproses unit, atau dikembalikan, dan antrean Super Admin menampilkan yang perlu tindakan.
4. Semua tindakan disposisi tercatat di riwayat tiket dan audit log.
5. Perilaku warga, TARA, dan Admin Kawasan tidak berubah (tes lama hijau tanpa diubah).

## 13. Keputusan (disetujui 11-11-2026)

| ID | Pertanyaan | Keputusan |
|---|---|---|
| K1 | Peran baru atau Admin Kawasan + unit? | **Peran baru `admin_unit`**: tugasnya berbeda dari agen Contact Center; akses jadi sempit dan jelas |
| K2 | Siapa yang boleh mendisposisi? | **Super Admin saja** (sesuai permintaan). Opsi nanti: Admin Kawasan *mengusulkan* unit |
| K3 | Satu tiket satu unit? | **Ya**, satu unit penanggung jawab. Unit pendukung di F5 |
| K4 | Nama unit tampil ke warga? | **Ya**, nama unit (bukan nama petugas): transparan seperti SP4N-LAPOR! |
| K5 | Tiket lama yang masih terbuka? | Tidak wajib didisposisi; tampil di saringan *Belum didisposisi* dengan tanda "lama" |
| K6 | Selesai perlu verifikasi Super Admin? | **Tidak**: unit boleh menutup; Super Admin bisa membuka kembali (sudah ada) |
| K7 | Eselon I melihat tiket semua unit di bawahnya? | **Nanti (F5)**; mulai dari unit sendiri saja |

## 14. Risiko

| Risiko | Peredam |
|---|---|
| `scopeVisibleTo` dipakai di banyak tempat (inbox chat, Matriks, API) | Petugas Unit tidak memakai rute admin sama sekali; tes per rute admin untuk peran baru |
| Unit tanpa petugas aktif → tiket menggantung | Peringatan saat disposisi + EWS "belum diterima 1 hari kerja" |
| Struktur organisasi berubah | Unit dinonaktifkan, bukan dihapus; riwayat tetap merujuk unit lama |
| Super Admin jadi hambatan (semua disposisi lewat satu orang) | Unit default per kategori mempercepat; opsi K2 (usulan oleh Admin Kawasan) |
