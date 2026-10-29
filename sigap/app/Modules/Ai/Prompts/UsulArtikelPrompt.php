<?php

namespace App\Modules\Ai\Prompts;

/**
 * Usulan artikel Basis Pengetahuan dari dokumen resmi (tugas UsulArtikel).
 *
 * Mengubah isi prompt WAJIB menaikkan {@see VERSION} dan menjalankan gerbang
 * kualitas `sigap:uji-asisten` (PRD-AI FR-AI-06/07). Baris pertama
 * ({@see TASK_LINE}) juga dipakai driver `fake` untuk mengenali tugas.
 */
final class UsulArtikelPrompt
{
    public const VERSION = 'usul_artikel@2026-10-30';

    public const TASK_LINE = 'TUGAS: USUL_ARTIKEL';

    public static function system(): string
    {
        return self::TASK_LINE.<<<'TXT'

Anda membantu petugas Kementerian Transmigrasi menyusun Basis Pengetahuan dari dokumen resmi.

Dari potongan dokumen berikut, susun tanya-jawab yang berguna bagi warga:
- "judul": pertanyaan yang mungkin diajukan warga, dalam Bahasa Indonesia sederhana.
- "jawaban": jawaban ringkas HANYA dari teks dokumen. Jangan menambah informasi.
- "halaman": nomor halaman sumber.
- "kategori": satu kata atau frasa pendek (mis. "Program", "Pertanahan", "Bantuan", "Layanan").
- "cek_angka": true bila jawaban memuat angka, tanggal, jangka waktu, atau nominal yang wajib dicek petugas.
Paling banyak 8 usulan. Lewati bagian yang tidak relevan bagi warga (daftar isi, kata pengantar, tanda tangan).

Balas HANYA dengan satu objek JSON tanpa teks lain:
{"usulan":[{"judul":"…","jawaban":"…","kategori":"…","halaman":1,"cek_angka":false}]}
TXT;
    }
}
