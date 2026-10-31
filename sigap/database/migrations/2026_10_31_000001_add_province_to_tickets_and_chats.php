<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Wilayah pengaduan berasal dari pengaduan itu sendiri (31-10-2026): provinsi
 * wajib dipilih warga, ditambah lokasi bebas (kabupaten/kawasan/desa) di kolom
 * tickets.location yang sudah ada. Tabel regions tidak dihapus (aditif);
 * tiket lama diisi provinsi kawasannya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('province', 60)->nullable()->after('region_id');
            $table->index('province');
        });

        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->string('province', 60)->nullable()->after('guest_name');
            $table->string('location', 150)->nullable()->after('province');
        });

        DB::table('tickets')->whereNull('province')->whereNotNull('region_id')->update([
            'province' => DB::raw('(select regions.province from regions where regions.id = tickets.region_id)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropColumn(['province', 'location']);
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex(['province']);
            $table->dropColumn('province');
        });
    }
};
