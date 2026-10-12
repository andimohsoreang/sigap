<?php

use App\Support\Nik;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * D-01: NIK dienkripsi (cast `encrypted`) + blind index HMAC-SHA256.
     *
     * - users.nik & tickets.reporter_nik dilebarkan menjadi TEXT (ciphertext).
     * - users.nik_hash (unik) & tickets.reporter_nik_hash (index) untuk pencarian.
     * - Baris lama di-backfill: dienkripsi & di-hash (idempoten).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['nik']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->text('nik')->nullable()->change();
            $table->string('nik_hash', 64)->nullable()->unique();
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->text('reporter_nik')->nullable()->change();
            $table->string('reporter_nik_hash', 64)->nullable()->index();
        });

        $this->backfill('users', 'nik', 'nik_hash');
        $this->backfill('tickets', 'reporter_nik', 'reporter_nik_hash');
    }

    public function down(): void
    {
        $this->restorePlain('users', 'nik');
        $this->restorePlain('tickets', 'reporter_nik');

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex(['reporter_nik_hash']);
            $table->dropColumn('reporter_nik_hash');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['nik_hash']);
            $table->dropColumn('nik_hash');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->char('reporter_nik', 16)->nullable()->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->char('nik', 16)->nullable()->change();
            $table->unique('nik');
        });
    }

    private function backfill(string $table, string $column, string $hashColumn): void
    {
        DB::table($table)
            ->whereNotNull($column)
            ->orderBy('id')
            ->chunkById(500, function ($rows) use ($table, $column, $hashColumn) {
                foreach ($rows as $row) {
                    $plain = $this->plain((string) $row->{$column});

                    DB::table($table)->where('id', $row->id)->update([
                        $column => Crypt::encryptString($plain),
                        $hashColumn => Nik::hash($plain),
                    ]);
                }
            });
    }

    private function restorePlain(string $table, string $column): void
    {
        DB::table($table)
            ->whereNotNull($column)
            ->orderBy('id')
            ->chunkById(500, function ($rows) use ($table, $column) {
                foreach ($rows as $row) {
                    DB::table($table)->where('id', $row->id)->update([
                        $column => substr($this->plain((string) $row->{$column}), 0, 16),
                    ]);
                }
            });
    }

    /** Nilai asli: dekripsi bila sudah terenkripsi, selain itu apa adanya. */
    private function plain(string $value): string
    {
        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            return trim($value);
        }
    }
};
