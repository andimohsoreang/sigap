<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dasar hukum Sumber Resmi & artikel (PRD-AI FR-AI-11) agar asisten dapat
 * membedakan aturan yang berlaku dari aturan lama. Hanya menambah kolom.
 *
 * - dasar_hukum   : peraturan yang menjadi dasar isi, mis. "Permentrans 3/2026".
 * - tanggal_dasar : tanggal penetapan peraturan itu.
 * - status_dasar  : berlaku | diganti | belum_diketahui.
 * - diganti_oleh  : peraturan pengganti bila status "diganti".
 */
return new class extends Migration
{
    private const TABLES = ['knowledge_sources', 'knowledge_articles'];

    public function up(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->string('dasar_hukum')->nullable();
                $table->date('tanggal_dasar')->nullable();
                $table->string('status_dasar', 20)->default('belum_diketahui');
                $table->string('diganti_oleh')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropColumn(['dasar_hukum', 'tanggal_dasar', 'status_dasar', 'diganti_oleh']);
            });
        }
    }
};
