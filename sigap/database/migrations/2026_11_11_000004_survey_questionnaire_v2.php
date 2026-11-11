<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Survei Kepuasan Pasca-Penanganan Pengaduan (skala 1–4, Permenpan RB 14/2017).
 * Survei lama (bintang 1–5) tetap tersimpan sebagai versi 1 dan tidak ikut
 * dihitung dalam indeks SKM. Tiket mendapat penanda tinjau ulang dan waktu
 * pengingat survei.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('surveys', function (Blueprint $table) {
            $table->smallInteger('rating')->nullable()->change();
            $table->unsignedTinyInteger('version')->default(1)->after('ticket_id');
            $table->json('answers')->nullable()->after('comment');
            $table->unsignedTinyInteger('overall')->nullable()->after('answers');
            $table->string('resolved', 10)->nullable()->after('overall');
            $table->unsignedTinyInteger('reuse')->nullable()->after('resolved');
            $table->text('good_feedback')->nullable()->after('reuse');
            $table->text('improve_feedback')->nullable()->after('good_feedback');
            $table->string('age_group', 20)->nullable()->after('improve_feedback');
            $table->string('education', 20)->nullable()->after('age_group');
            $table->string('occupation', 30)->nullable()->after('education');
            $table->decimal('skm_index', 5, 2)->nullable()->after('occupation');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->timestamp('review_requested_at')->nullable()->after('resolved_at');
            $table->string('review_reason', 20)->nullable()->after('review_requested_at');
            $table->timestamp('reviewed_at')->nullable()->after('review_reason');
            $table->foreignId('reviewed_by')->nullable()->after('reviewed_at')->constrained('users')->nullOnDelete();
            $table->timestamp('survey_reminded_at')->nullable()->after('reviewed_by');
            $table->index('review_requested_at');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex(['review_requested_at']);
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn(['review_requested_at', 'review_reason', 'reviewed_at', 'survey_reminded_at']);
        });

        Schema::table('surveys', function (Blueprint $table) {
            $table->dropColumn(['version', 'answers', 'overall', 'resolved', 'reuse', 'good_feedback', 'improve_feedback', 'age_group', 'education', 'occupation', 'skm_index']);
        });
    }
};
