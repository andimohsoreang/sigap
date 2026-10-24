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
 * S-03: perintah ini MENGHAPUS seluruh isi database, sehingga menolak jalan
 * tanpa syarat (tidak ada opsi --force) kecuali:
 *   - APP_ENV adalah `local` atau `testing`, DAN
 *   - database adalah SQLite, atau host database berada di mesin ini
 *     (127.0.0.1 / localhost / ::1 / socket) — tidak pernah host DB remote/produksi.
 */
class E2eSetupCommand extends Command
{
    protected $signature = 'sigap:e2e-setup';

    /** Host database yang dianggap lokal (aman untuk migrate:fresh). */
    private const LOCAL_DB_HOSTS = ['', '127.0.0.1', 'localhost', '::1'];

    protected $description = 'Siapkan database & akun uji untuk E2E Playwright (dev/test saja)';

    public function handle(): int
    {
        if (($reason = $this->refusalReason()) !== null) {
            $this->error("sigap:e2e-setup ditolak: {$reason}");

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
        $warga->forceFill(['email_verified_at' => now()])->save();

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

    /** Alasan penolakan, atau null bila lingkungan aman untuk dihapus. */
    private function refusalReason(): ?string
    {
        if (! $this->laravel->environment(['local', 'testing'])) {
            return 'APP_ENV harus local atau testing (sekarang: '.$this->laravel->environment().').';
        }

        $connection = (string) config('database.default');
        $driver = (string) config("database.connections.{$connection}.driver");

        if ($driver === 'sqlite') {
            return null;
        }

        $host = strtolower(trim((string) config("database.connections.{$connection}.host")));
        $url = (string) config("database.connections.{$connection}.url");

        if ($url !== '') {
            $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        }

        if (! in_array($host, self::LOCAL_DB_HOSTS, true) && ! str_starts_with($host, '/')) {
            return "host database '{$host}' bukan host lokal — tidak akan menghapus database remote/produksi.";
        }

        return null;
    }
}
