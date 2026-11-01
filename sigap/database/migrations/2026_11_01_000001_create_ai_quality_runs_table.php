<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ringkasan tiap uji kualitas `sigap:uji-asisten --simpan` (PRD-AI FR-AI-07/08):
 * hanya angka hasil, tanpa pertanyaan maupun jawaban. Ditampilkan di halaman
 * Kesehatan AI. Migrasi hanya menambah tabel baru (rollback aman).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_quality_runs', function (Blueprint $table) {
            $table->id();
            $table->string('model', 120)->nullable();
            $table->boolean('with_model');
            // null = dijalankan tanpa ambang (hanya laporan).
            $table->boolean('passed')->nullable();
            $table->unsignedSmallInteger('retrieval_hits');
            $table->unsignedSmallInteger('retrieval_total');
            $table->unsignedSmallInteger('classification_hits');
            $table->unsignedSmallInteger('classification_total');
            $table->unsignedSmallInteger('unsourced');
            $table->unsignedSmallInteger('failed_calls');
            $table->unsignedSmallInteger('number_rejections');
            $table->unsignedInteger('median_ms')->nullable();
            $table->unsignedInteger('p95_ms')->nullable();
            $table->string('failures', 255)->nullable();
            $table->unsignedInteger('duration_s');
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_quality_runs');
    }
};
