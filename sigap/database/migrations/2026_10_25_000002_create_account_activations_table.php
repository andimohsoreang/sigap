<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Akun warga yang didaftarkan petugas dari percakapan live chat.
 *
 * - users.registered_by : petugas yang mendaftarkan (identitas dicek petugas,
 *   sehingga Portal Warga tidak menunggu verifikasi surel).
 * - users.activated_at  : warga sudah membuat kata sandi sendiri.
 * - account_activations : tautan sekali pakai "buat kata sandi" yang dikirim
 *   ke chat warga — untuk akun baru (aktivasi) maupun lupa kata sandi
 *   (pemulihan). Token hanya disimpan sebagai hash.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('registered_by')->nullable()->after('is_active')->constrained('users')->nullOnDelete();
            $table->timestamp('activated_at')->nullable()->after('registered_by');
        });

        Schema::create('account_activations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained('chat_conversations')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('purpose', 20)->default('aktivasi');
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'used_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_activations');

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('registered_by');
            $table->dropColumn('activated_at');
        });
    }
};
