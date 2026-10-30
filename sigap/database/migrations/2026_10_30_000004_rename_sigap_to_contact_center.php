<?php

use App\Models\KnowledgeArticle;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Nama aplikasi berubah dari "SIGAP" menjadi "Contact Center" (30-10-2026).
 * Data yang tampil ke warga dan disimpan sebelumnya ikut diganti: artikel
 * Basis Pengetahuan (judul, isi, kategori, sumber, kata kunci) dan teks
 * katalog portal. Riwayat audit (activity_logs) tidak diubah.
 */
return new class extends Migration
{
    /** @var array<string, list<string>> */
    private const COLUMNS = [
        'knowledge_articles' => ['title', 'body', 'category', 'source', 'keywords'],
        'portals' => ['purpose', 'description', 'steps', 'prepare'],
    ];

    public function up(): void
    {
        foreach (self::COLUMNS as $table => $columns) {
            foreach ($columns as $column) {
                DB::table($table)->where($column, 'like', '%SIGAP%')->update([
                    $column => DB::raw("REPLACE({$column}, 'SIGAP', 'Contact Center')"),
                ]);
            }
        }

        // Pembaruan lewat query builder tidak memicu event model: indeks
        // pencarian artikel yang ter-cache dibuang agar TARA memakai judul baru.
        Cache::forget(KnowledgeArticle::CACHE_KEY);
    }

    public function down(): void
    {
        // Penggantian nama tidak dibalik.
    }
};
