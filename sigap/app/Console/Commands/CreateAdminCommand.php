<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Membuat akun admin/petugas secara interaktif.
 *
 * PRD SEC-01: TIDAK ada kredensial default yang di-hardcode. Akun admin harus
 * dibuat eksplisit oleh operator (tidak disemai otomatis) sehingga tidak ada
 * password contoh yang bocor ke produksi.
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'sigap:admin
        {--username= : Username admin (tanpa spasi)}
        {--name= : Nama lengkap}
        {--role=super_admin : Peran (admin_kawasan|super_admin)}';

    protected $description = 'Membuat akun admin/petugas SIGAP (interaktif)';

    public function handle(): int
    {
        $username = $this->option('username') ?: $this->ask('Username admin');
        $name = $this->option('name') ?: $this->ask('Nama lengkap', 'Administrator SIGAP');
        $roleInput = $this->option('role') ?: $this->choice('Peran', ['admin_kawasan', 'super_admin'], 1);
        $password = $this->secret('Kata sandi (min 8 karakter)');
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
            'password' => ['required', 'string', 'min:8', 'confirmed'],
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
            'password' => $password,
            'is_active' => true,
        ]);

        $this->info("Admin dibuat: {$user->username} ({$user->role->label()}).");

        return self::SUCCESS;
    }
}