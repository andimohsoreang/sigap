<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catatan setiap panggilan model AI (PRD-AI FR-AI-02). Hanya angka dan kode,
 * TANPA isi pertanyaan maupun jawaban. Migrasi hanya menambah tabel baru,
 * sehingga versi lama tetap berjalan di atas skema ini (rollback aman).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_calls', function (Blueprint $table) {
            $table->id();
            $table->string('task', 40);
            $table->string('prompt_version', 64)->nullable();
            $table->string('provider', 120)->nullable();
            $table->string('model', 120)->nullable();
            $table->string('status', 16);
            $table->unsignedInteger('latency_ms');
            $table->unsignedInteger('prompt_tokens')->nullable();
            $table->unsignedInteger('completion_tokens')->nullable();
            $table->foreignId('conversation_id')->nullable()->constrained('chat_conversations')->nullOnDelete();
            $table->string('error_code', 40)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['task', 'created_at']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_calls');
    }
};
