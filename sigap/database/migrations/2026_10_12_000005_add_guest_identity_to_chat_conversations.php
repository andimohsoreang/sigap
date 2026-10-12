<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identitas tamu live chat: tamu wajib mengisi nama sebelum mengirim pesan
 * agar petugas tahu siapa yang bertanya. Warga login memakai akunnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->string('guest_name', 100)->nullable()->after('guest_token');
        });
    }

    public function down(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropColumn('guest_name');
        });
    }
};
