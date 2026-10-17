<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * - keywords   : kata kunci/sinonim tambahan yang ditulis petugas agar artikel
 *                ditemukan dengan istilah warga ("jatah hidup", "SHM").
 * - source_url : tautan dokumen resmi (JDIH/PPID) yang ditampilkan ke warga.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('knowledge_articles', function (Blueprint $table) {
            $table->string('keywords', 500)->nullable()->after('category');
            $table->string('source_url', 500)->nullable()->after('source_ref');
        });
    }

    public function down(): void
    {
        Schema::table('knowledge_articles', function (Blueprint $table) {
            $table->dropColumn(['keywords', 'source_url']);
        });
    }
};
