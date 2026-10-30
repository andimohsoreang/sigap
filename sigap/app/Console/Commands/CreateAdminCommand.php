<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Http\Controllers\Web\AdminController;
use App\Models\Region;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Membuat akun admin/petugas secara interaktif.
 *
 * PRD SEC-01: TIDAK ada kredensial default yang di-hardcode. Akun admin harus
 * dibuat eksplisit oleh operator (tidak disemai otomatis) sehingga tidak ada
 * password contoh yang bocor ke produksi.
 *
 * A-05: admin kawasan wajib memiliki kawasan (`--region=<id|kode>` atau pilihan
 * interaktif). A-18: kata sandi minimal 12 karakter, huruf besar, huruf kecil
 * dan angka.
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'sigap:admin
        {--username= : Username admin (tanpa spasi)}
        {--name= : Nama lengkap}
        {--role=super_admin : Peran (admin_kawasan|super_admin)}
        {--region= : ID atau kode kawasan (wajib untuk admin_kawasan)}';

    protected $description = 'Membuat akun admin/petugas Contact Center (interaktif)';

    public function handle(): int
    {
        $username = $this->option('username') ?: $this->ask('Username admin');
        $name = $this->option('name') ?: $this->ask('Nama lengkap', 'Administrator Contact Center');
        $roleInput = $this->option('role') ?: $this->choice('Peran', ['admin_kawasan', 'super_admin'], 1);

        $regionId = null;
        if ($roleInput === UserRole::AdminKawasan->value) {
            $regionId = $this->resolveRegion();

            if ($regionId === null) {
                $this->error('Admin kawasan wajib memiliki kawasan yang valid (--region=<id|kode>).');

                return self::FAILURE;
            }
        }

        $password = $this->secret('Kata sandi (min 12 karakter, huruf besar, huruf kecil & angka)');
        $confirm = $this->secret('Ulangi kata sandi');

        $validator = Validator::make([
            'username' => $username,
            'name' => $name,
            'role' => $roleInput,
            'password' => $password,
            'password_confirmation' => $confirm,
        ], [
            'username' => ['required', 'alpha_dash', 'min:3', 'unique:users,username'],
            'name' => ['required', 'string', 'max:150'],
            'role' => ['required', 'in:admin_kawasan,super_admin'],
            'password' => ['required', 'string', 'confirmed', AdminController::adminPasswordRule()],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::create([
            'username' => $username,
            'name' => $name,
            'role' => UserRole::from($roleInput),
            'region_id' => $regionId,
            'password' => $password,
            'is_active' => true,
        ]);

        $this->info("Admin dibuat: {$user->username} ({$user->role->label()}).");

        return self::SUCCESS;
    }

    /** Kawasan dari opsi --region (id/kode) atau pilihan interaktif. */
    private function resolveRegion(): ?int
    {
        $option = $this->option('region');

        if ($option !== null && $option !== '') {
            return Region::query()
                ->where(fn ($q) => ctype_digit((string) $option)
                    ? $q->whereKey((int) $option)->orWhere('code', $option)
                    : $q->where('code', $option))
                ->value('id');
        }

        $regions = Region::query()->orderBy('id')->get(['id', 'code', 'name']);

        if ($regions->isEmpty() || ! $this->input->isInteractive()) {
            return null;
        }

        $choices = $regions->mapWithKeys(fn (Region $r) => [$r->code => "{$r->code} — {$r->name}"])->all();
        $label = $this->choice('Kawasan tugas', array_values($choices));
        $code = array_search($label, $choices, true);

        return $regions->firstWhere('code', $code)?->id;
    }
}
