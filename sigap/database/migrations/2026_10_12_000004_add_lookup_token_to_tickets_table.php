<?php

use App\Models\Ticket;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kode akses pelacakan (`lookup_token`, 8 karakter acak) — wajib bagi tamu
     * yang melacak tiket bernomor format lama `TKT-<n>` (mudah di-enumerasi).
     * Semua baris lama (termasuk soft-deleted) diisi token baru.
     */
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('lookup_token', 16)->nullable();
        });

        DB::table('tickets')
            ->whereNull('lookup_token')
            ->orderBy('id')
            ->select('id')
            ->chunkById(500, function ($rows) {
                DB::transaction(function () use ($rows) {
                    foreach ($rows as $row) {
                        DB::table('tickets')
                            ->where('id', $row->id)
                            ->update(['lookup_token' => Ticket::generateLookupToken()]);
                    }
                });
            });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn('lookup_token');
        });
    }
};
