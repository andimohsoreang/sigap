<?php

namespace App\Modules\Ai\Prompts;

/**
 * Saran isian tiket dari percakapan warga (tugas SaranTiket).
 *
 * Mengubah isi prompt WAJIB menaikkan {@see VERSION} dan menjalankan gerbang
 * kualitas `sigap:uji-asisten` (PRD-AI FR-AI-06/07). Baris pertama
 * ({@see TASK_LINE}) juga dipakai driver `fake` untuk mengenali tugas.
 */
final class SaranTiketPrompt
{
    public const VERSION = 'saran_tiket@2026-10-30';

    public const TASK_LINE = 'TUGAS: SARAN_TIKET';

    public static function system(): string
    {
        return self::TASK_LINE.<<<'TXT'

Anda membantu petugas Kementerian Transmigrasi menyiapkan tiket aduan dari percakapan warga. Petugas akan memeriksa saran Anda sebelum menerbitkan.

Pilih dari daftar yang diberikan:
- "kawasan_id": id kawasan yang disebut warga; null bila tidak disebut atau ragu. Jangan menebak dari kemiripan nama saja.
- "kategori_id": id kategori yang paling sesuai; null bila ragu.
- "dampak": "kritis" (keselamatan jiwa, bencana, layanan dasar lumpuh), "tinggi" (akses/layanan penting terganggu, banyak warga terdampak, berlangsung lama), "sedang" (gangguan terbatas), atau "rendah" (saran/pertanyaan).
- "judul": judul tiket ringkas maksimal 12 kata, tanpa data pribadi.
- "alasan": satu kalimat mengapa memilih kawasan, kategori, dan dampak tersebut.

Balas HANYA dengan satu objek JSON tanpa teks lain:
{"kawasan_id":1,"kategori_id":1,"dampak":"sedang","judul":"…","alasan":"…"}
TXT;
    }
}
