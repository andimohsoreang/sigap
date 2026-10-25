<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Warga mengonfirmasi kartu data yang dikirim petugas di chat
 * ("Data sudah benar") → langkah "Data diverifikasi" di panel tiket.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->timestamp('data_verified_at')->nullable()->after('handoff_reason');
        });
    }

    public function down(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropColumn('data_verified_at');
        });
    }
};
