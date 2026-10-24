<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Portal Warga kini mewajibkan surel terverifikasi (middleware `verified`).
 * Akun warga yang sudah ada sebelum pendaftaran mandiri dibuat oleh
 * petugas/skrip, jadi dianggap terverifikasi agar tidak terkunci.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'warga')
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        // Tidak dapat dibedakan dari verifikasi asli; dibiarkan.
    }
};
