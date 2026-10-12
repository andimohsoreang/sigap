<?php

namespace App\Console\Commands;

use App\Support\Nik;
use Illuminate\Console\Command;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Hitung ulang blind index NIK (D-01) setelah NIK_HASH_KEY diganti.
 *
 * Membaca NIK terenkripsi (APP_KEY saat ini atau APP_PREVIOUS_KEYS), lalu
 * menulis ulang `users.nik_hash` & `tickets.reporter_nik_hash` dengan kunci
 * NIK_HASH_KEY yang aktif. Diproses per-chunk di dalam SATU transaksi:
 * bila ada baris yang gagal didekripsi, semua perubahan dibatalkan.
 */
class RehashNikCommand extends Command
{
    protected $signature = 'sigap:rehash-nik
        {--chunk=500 : Jumlah baris per batch}
        {--force : Jalankan tanpa konfirmasi (produksi)}';

    protected $description = 'Hitung ulang nik_hash & reporter_nik_hash dengan NIK_HASH_KEY saat ini';

    /** @var array<int, array{0: string, 1: string, 2: string}> tabel, kolom NIK, kolom hash */
    private const TARGETS = [
        ['users', 'nik', 'nik_hash'],
        ['tickets', 'reporter_nik', 'reporter_nik_hash'],
    ];

    public function handle(): int
    {
        Nik::assertKeyConfigured();

        if (! Nik::hasDedicatedKey()) {
            $this->warn('NIK_HASH_KEY kosong — memakai APP_KEY (hanya untuk lokal/testing).');
        }

        if (app()->environment('production') && ! $this->option('force')
            && ! $this->confirm('Hitung ulang semua blind index NIK sekarang?')) {
            $this->info('Dibatalkan.');

            return self::SUCCESS;
        }

        $chunk = max(1, (int) $this->option('chunk'));
        $counts = [];

        try {
            DB::transaction(function () use ($chunk, &$counts) {
                foreach (self::TARGETS as [$table, $column, $hashColumn]) {
                    $counts[$table] = 0;

                    DB::table($table)
                        ->whereNotNull($column)
                        ->select(['id', $column])
                        ->orderBy('id')
                        ->chunkById($chunk, function ($rows) use ($table, $column, $hashColumn, &$counts) {
                            foreach ($rows as $row) {
                                $plain = $this->decrypt((string) $row->{$column}, $table, (int) $row->id);

                                DB::table($table)->where('id', $row->id)->update([
                                    $hashColumn => Nik::hash($plain),
                                ]);
                                $counts[$table]++;
                            }
                        });
                }
            });
        } catch (DecryptException $e) {
            $this->error($e->getMessage());
            $this->error('Tidak ada perubahan yang disimpan. Pastikan APP_KEY / APP_PREVIOUS_KEYS memuat kunci enkripsi lama.');

            return self::FAILURE;
        }

        foreach ($counts as $table => $count) {
            $this->info("{$table}: {$count} baris diperbarui.");
        }

        return self::SUCCESS;
    }

    private function decrypt(string $value, string $table, int $id): string
    {
        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            throw new DecryptException("Gagal mendekripsi NIK pada {$table}#{$id}.");
        }
    }
}
