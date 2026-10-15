<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Contact center: percakapan bisa ditangani asisten AI lalu diteruskan ke
 * petugas, dan setiap percakapan ditutup dengan satu hasil.
 *
 * Percakapan lama bernilai `handled_by = petugas` sehingga perilakunya tetap.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->string('handled_by', 20)->default('petugas')->after('subject'); // ai|petugas
            $table->timestamp('handoff_at')->nullable()->after('handled_by');
            $table->string('handoff_reason', 30)->nullable()->after('handoff_at');
            $table->text('ai_summary')->nullable()->after('handoff_reason');
            $table->string('reference', 20)->nullable()->unique()->after('ai_summary');
            $table->text('contact')->nullable()->after('reference'); // terenkripsi (cast)
            $table->foreignId('assigned_to')->nullable()->after('contact')->constrained('users')->nullOnDelete();
            $table->string('outcome', 30)->nullable()->index()->after('assigned_to');
            $table->timestamp('closed_at')->nullable()->after('outcome');
            $table->foreignId('closed_by')->nullable()->after('closed_at')->constrained('users')->nullOnDelete();
            $table->foreignId('ticket_id')->nullable()->after('closed_by')->constrained('tickets')->nullOnDelete();
        });

        Schema::table('chat_messages', function (Blueprint $table) {
            $table->json('meta')->nullable()->after('body');
            $table->smallInteger('feedback')->nullable()->after('meta'); // 1 membantu, -1 tidak
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropColumn(['meta', 'feedback']);
        });

        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ticket_id');
            $table->dropConstrainedForeignId('closed_by');
            $table->dropConstrainedForeignId('assigned_to');
            $table->dropUnique(['reference']);
            $table->dropColumn(['handled_by', 'handoff_at', 'handoff_reason', 'ai_summary', 'reference', 'contact', 'outcome', 'closed_at']);
        });
    }
};
