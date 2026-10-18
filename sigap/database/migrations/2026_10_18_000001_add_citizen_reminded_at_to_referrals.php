<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Kapan warga terakhir diingatkan lewat chat untuk mengirim kode bukti. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('referrals', function (Blueprint $table) {
            $table->timestamp('citizen_reminded_at')->nullable()->after('reminded_at');
        });
    }

    public function down(): void
    {
        Schema::table('referrals', function (Blueprint $table) {
            $table->dropColumn('citizen_reminded_at');
        });
    }
};
