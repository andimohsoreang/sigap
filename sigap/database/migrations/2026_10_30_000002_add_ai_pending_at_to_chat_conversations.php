<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penanda TARA sedang menyiapkan jawaban di antrean `ai` (PRD-AI FR-AI-04, §7):
 * dipakai indikator mengetik dan deteksi job macet. Kolom baru, nullable —
 * versi lama tetap berjalan di atas skema ini.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->timestamp('ai_pending_at')->nullable()->after('handoff_reason');
        });
    }

    public function down(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropColumn('ai_pending_at');
        });
    }
};
