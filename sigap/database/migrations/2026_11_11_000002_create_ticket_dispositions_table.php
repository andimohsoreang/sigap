<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Disposisi tiket ke Unit Kerja (PRD-UNIT-KERJA F2). Aditif.
 * - tickets.unit_id     : unit penangan SAAT INI (untuk penyaringan cepat).
 * - ticket_dispositions : riwayat lengkap; paling banyak satu baris aktif
 *                         (menunggu/diterima) per tiket, dijaga di service.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->foreignId('unit_id')->nullable()->after('assignee_id')->constrained('units')->nullOnDelete();
            $table->timestamp('disposed_at')->nullable()->after('unit_id');
        });

        Schema::create('ticket_dispositions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_id')->constrained('units')->restrictOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 20)->default('menunggu');
            $table->text('note')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->text('return_reason')->nullable();
            $table->timestamps();

            $table->index(['unit_id', 'status']);
            $table->index(['ticket_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_dispositions');

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('unit_id');
            $table->dropColumn('disposed_at');
        });
    }
};
