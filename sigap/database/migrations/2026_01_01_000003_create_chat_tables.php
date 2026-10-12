<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('guest_token', 64)->nullable();
            $table->string('subject', 200)->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->integer('unread_admin')->default(0);
            $table->integer('unread_user')->default(0);
            $table->timestamps();
        });

        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('chat_conversations')->cascadeOnDelete();
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sender_type', 20)->default('user'); // user|admin|system
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
        });

        // Log sinkronisasi kanal nasional (stub adapter — PRD D7)
        Schema::create('channel_sync_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->nullable()->constrained('channels')->nullOnDelete();
            $table->string('channel', 30)->nullable();
            $table->integer('pulled_count')->default(0);
            $table->string('status', 20)->default('berhasil');
            $table->text('message')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channel_sync_logs');
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('chat_conversations');
    }
};