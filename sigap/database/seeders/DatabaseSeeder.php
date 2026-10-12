<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed data master SIGAP.
     *
     * PRD SEC-01 & kriteria penerimaan: TIDAK ada akun/kredensial contoh yang
     * disemai otomatis. Akun admin dibuat eksplisit lewat
     * `php artisan sigap:admin`; akun warga mendaftar sendiri.
     */
    public function run(): void
    {
        $this->call(MasterSeeder::class);
    }
}
