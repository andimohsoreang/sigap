<?php

use App\Models\KnowledgeArticle;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * KnowledgeSeeder hanya berjalan pada basis pengetahuan kosong, jadi
 * instalasi yang sudah berjalan tidak menerima jawaban baru tentang akun:
 * - "Bagaimana cara masuk sebagai warga?" diperbarui (daftar mandiri,
 *   dibantu petugas lewat chat, lupa sandi) — HANYA bila isinya masih teks
 *   bawaan, agar suntingan admin tidak tertimpa.
 * - Artikel baru "lupa kata sandi tanpa email" ditambahkan bila belum ada.
 * Basis pengetahuan kosong dibiarkan untuk diisi seeder.
 */
return new class extends Migration
{
    private const MASUK = 'Bagaimana cara masuk sebagai warga?';

    private const MASUK_LAMA = 'Pilih menu Masuk, lalu gunakan NIK atau nama pengguna dan kata sandi Anda. Hak akses admin hanya diberikan kepada pegawai yang terdaftar.';

    private const MASUK_BARU = 'Belum punya akun? Pilih menu Masuk lalu klik "Daftar di sini", isi NIK, nama, email, dan kata sandi, kemudian klik tautan verifikasi yang dikirim ke email Anda. Setelah itu masuk dengan NIK dan kata sandi. Tidak punya email? Tulis di chat ini dan minta dibantu petugas; petugas dapat membuatkan akun untuk Anda cukup dengan NIK dan nama sesuai KTP. Lupa kata sandi? Klik "Lupa kata sandi?" di halaman Masuk untuk menerima tautan atur ulang lewat email. Hak akses admin hanya diberikan kepada pegawai yang terdaftar.';

    private const LUPA = 'Saya lupa kata sandi dan tidak punya email, bagaimana?';

    private const LUPA_ISI = 'Tekan "Bicara dengan petugas" di chat ini. Petugas akan menanyakan NIK dan nomor HP yang dulu Anda daftarkan. Bila cocok, Anda menerima tombol "Buat kata sandi baru" di chat; tekan tombol itu, buat kata sandi baru, dan Anda langsung masuk. Petugas tidak akan pernah menanyakan kata sandi Anda. Bila akun Anda punya email aktif, Anda juga bisa memakai menu "Lupa kata sandi?" di halaman Masuk.';

    public function up(): void
    {
        if (! DB::table('knowledge_articles')->exists()) {
            return;
        }

        DB::table('knowledge_articles')
            ->where('title', self::MASUK)
            ->where('body', self::MASUK_LAMA)
            ->update(['body' => self::MASUK_BARU, 'updated_at' => now()]);

        if (! DB::table('knowledge_articles')->where('title', self::LUPA)->exists()) {
            DB::table('knowledge_articles')->insert([
                'title' => self::LUPA,
                'body' => self::LUPA_ISI,
                'category' => 'Layanan SIGAP',
                'source' => 'Panduan Layanan SIGAP',
                'status' => 'terbit',
                'review_at' => now()->addMonths(6)->toDateString(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Indeks pencarian asisten di-cache 10 menit; segarkan sekarang.
        Cache::forget(KnowledgeArticle::CACHE_KEY);
    }

    public function down(): void
    {
        DB::table('knowledge_articles')->where('title', self::LUPA)->where('body', self::LUPA_ISI)->delete();
        DB::table('knowledge_articles')
            ->where('title', self::MASUK)
            ->where('body', self::MASUK_BARU)
            ->update(['body' => self::MASUK_LAMA, 'updated_at' => now()]);

        Cache::forget(KnowledgeArticle::CACHE_KEY);
    }
};
