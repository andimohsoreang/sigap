<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Contact center sebagai gerbang portal Kementerian Transmigrasi.
 *
 * - portals          : katalog portal (publik/internal) yang dapat dirujuk.
 * - referrals        : rujukan warga ke portal, dengan satu petugas
 *                      penanggung jawab sampai warga terbukti berhasil.
 * - referral_events  : jejak tindak lanjut (siapa, kapan, apa) untuk
 *                      akuntabilitas penanggung jawab.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portals', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name', 100);
            $table->string('url', 500);
            $table->string('action_url', 500)->nullable();
            $table->string('action_label', 60)->nullable();
            $table->string('audience', 10)->default('publik'); // publik|internal
            $table->string('purpose', 255);
            $table->text('description')->nullable();
            $table->string('keywords', 500)->nullable();
            $table->text('steps')->nullable();
            $table->text('prepare')->nullable();
            $table->string('proof_label', 60)->nullable();
            $table->boolean('track_completion')->default(false);
            $table->string('managed_by', 150)->nullable();
            $table->string('contact', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->boolean('is_reachable')->default(true);
            $table->unsignedSmallInteger('last_status')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->string('code', 20)->unique();
            $table->foreignId('portal_id')->constrained('portals')->restrictOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained('chat_conversations')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('citizen_name', 120)->nullable();
            $table->text('contact')->nullable(); // terenkripsi
            $table->text('summary')->nullable();
            $table->string('status', 20)->default('dirujuk')->index();
            $table->string('external_ref', 100)->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('follow_up_due_at')->nullable()->index();
            $table->timestamp('reminded_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('close_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('referral_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referral_id')->constrained('referrals')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor', 10); // warga|petugas|ai|sistem
            $table->string('type', 30);
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_events');
        Schema::dropIfExists('referrals');
        Schema::dropIfExists('portals');
    }
};
