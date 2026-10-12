<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Menyiapkan lingkungan E2E (Playwright).
 *
 * Menjalankan `migrate:fresh --seed` pada database yang sedang dikonfigurasi
 * (honeyake `database/e2e.sqlite`) lalu membuat AKUN UJI dengan kata sandi yang
 * di-generate acak. Kredensial tidak pernah ditulis di source (SEC-01) dan
 * disimpan ke `storage/app/e2e/credentials.json` untuk dibaca Playwright.
 *
 * Perintah ini menolak jalan bila APP_ENV=production.
 */
class E2eSetupCommand extends Command
{
    protected $signature = 'sigap:e2e-setup {--force : Jalankan meski APP_ENV bukan testing/local}';

    protected $description = 'Siapkan database & akun uji untuk E2E Playwright (dev/test saja)';

    public function handle(): int
    {
        $env = (string) config('app.env');

        if ($env === 'production' && ! $this->option('force')) {
            $this->error('sigap:e2e-setup tidak boleh jalan di APP_ENV=production.');

            return self::FAILURE;
        }

        $this->call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->components->info('Migrasi + seed master selesai.');

        $password = (string) (env('E2E_PASSWORD') ?: Str::password(16));
        $region = Region::query()->where('is_active', true)->first();

        $admin = User::query()->updateOrCreate(
            ['username' => 'e2e-admin'],
            [
                'name' => 'Petugas Uji E2E',
                'email' => 'e2e-admin@example.test',
                'role' => UserRole::SuperAdmin,
                'region_id' => $region?->id,
                'unit' => 'Biro Umum',
                'is_active' => true,
                'password' => Hash::make($password),
            ]
        );

        $warga = User::query()->updateOrCreate(
            ['nik' => '3273010101900001'],
            [
                'name' => 'Warga Uji E2E',
                'email' => 'e2e-warga@example.test',
                'role' => UserRole::Warga,
                'is_active' => true,
                'password' => Hash::make($password),
            ]
        );

        $ticket = Ticket::factory()->count(2)->create([
            'region_id' => $region?->id,
        ]);

        $dir = storage_path('app/e2e');
        File::ensureDirectoryExists($dir);

        $credentials = [
            'username' => $admin->username,
            'password' => $password,
            'warga_nik' => $warga->nik,
            'warga_password' => $password,
            'tiket_awal' => $ticket->pluck('ticket_no')->all(),
        ];

        File::put($dir.'/credentials.json', json_encode($credentials, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        $this->components->info('Kredensial uji: storage/app/e2e/credentials.json');
        $this->line('Tiket awal: '.implode(', ', $credentials['tiket_awal']));

        return self::SUCCESS;
    }
}