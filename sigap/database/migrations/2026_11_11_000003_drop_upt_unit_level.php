<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Tingkat UPT dihapus dari master Unit Kerja. Empat Balai bawaan UnitSeeder
 * ikut dihapus selama belum dirujuk petugas, tiket, disposisi, atau sub-unit;
 * unit bertingkat UPT yang tersisa menjadi "lainnya".
 */
return new class extends Migration
{
    private const BALAI = ['UPT-BBPPMT-YOGYA', 'UPT-BPPMT-PEKANBARU', 'UPT-BPPMT-BANJARMASIN', 'UPT-BPPMT-DENPASAR'];

    public function up(): void
    {
        $ids = DB::table('units')->whereIn('code', self::BALAI)->pluck('id');
        $used = collect()
            ->merge(DB::table('units')->whereIn('parent_id', $ids)->pluck('parent_id'))
            ->merge(DB::table('users')->whereIn('unit_id', $ids)->pluck('unit_id'))
            ->merge(DB::table('tickets')->whereIn('unit_id', $ids)->pluck('unit_id'))
            ->merge(DB::table('tickets')->whereIn('reporter_unit_id', $ids)->pluck('reporter_unit_id'))
            ->merge(DB::table('ticket_dispositions')->whereIn('unit_id', $ids)->pluck('unit_id'));

        DB::table('units')->whereIn('id', $ids->diff($used))->delete();
        DB::table('units')->where('level', 'upt')->update(['level' => 'lainnya']);
    }

    /** Data Balai tidak dikembalikan; tambahkan lewat halaman Unit Kerja bila perlu. */
    public function down(): void {}
};
