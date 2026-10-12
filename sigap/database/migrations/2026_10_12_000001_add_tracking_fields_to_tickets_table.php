<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kolom tambahan tiket:
     * - deleted_at      : soft delete (A-03) — nomor tiket tidak pernah dipakai ulang.
     * - ews_notified_at : penanda peringatan EWS sudah dikirim (D-07).
     * - source, source_url, received_by : data input manual (A-11).
     * - reporter_nip, reporter_unit, location : data formulir internal (A-12).
     */
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->softDeletes();
            $table->timestamp('ews_notified_at')->nullable();
            $table->string('source', 30)->nullable();
            $table->string('source_url', 500)->nullable();
            $table->string('received_by', 150)->nullable();
            $table->string('reporter_nip', 30)->nullable();
            $table->string('reporter_unit', 120)->nullable();
            $table->string('location', 150)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn([
                'ews_notified_at',
                'source',
                'source_url',
                'received_by',
                'reporter_nip',
                'reporter_unit',
                'location',
            ]);
        });
    }
};
