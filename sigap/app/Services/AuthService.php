<?php

namespace App\Services;

use App\Models\User;
use App\Support\Nik;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Autentikasi gabungan: warga (NIK) maupun petugas (username) lewat satu
 * identifier (PRD D3). Dipakai bersama oleh jalur Web (Inertia) & Api.
 *
 * A-17: identifier 16 digit angka diperlakukan sebagai NIK (dicari lewat
 * blind index `nik_hash`), selain itu sebagai username — tidak ada lagi
 * ambiguitas username yang kebetulan sama dengan NIK orang lain. Bila akun
 * tidak ditemukan tetap dilakukan Hash::check tiruan agar waktu respons
 * tidak membocorkan keberadaan akun (timing attack).
 */
class AuthService
{
    public function __construct(private readonly AuditService $audit) {}

    /**
     * Menentukan user dari identifier lalu memverifikasi kata sandi.
     *
     * @throws ValidationException
     */
    public function attempt(string $identifier, string $password, bool $remember = false): User
    {
        $identifier = trim($identifier);
        $byNik = Nik::looksLikeNik($identifier);

        $user = $byNik
            ? User::findByNik($identifier)
            : User::query()->where('username', $identifier)->first();

        $valid = $user !== null
            ? Hash::check($password, $user->password)
            : $this->dummyCheck($password);

        if (! $user || ! $valid || ! $user->is_active) {
            $this->audit->safe('auth.login_failed', $user, 'Login gagal.', [
                'identifier' => $byNik ? Nik::mask($identifier) : mb_substr($identifier, 0, 50),
                'reason' => ! $user ? 'not_found' : (! $valid ? 'bad_password' : 'inactive'),
            ]);

            throw ValidationException::withMessages([
                'identifier' => 'NIK/username atau kata sandi salah.',
            ]);
        }

        Auth::login($user, $remember);

        $this->audit->safe('auth.login', $user, "Login berhasil: {$user->name}.");

        return $user;
    }

    /** Akhiri sesi web (dan catat audit untuk pengguna yang keluar). */
    public function logout(?User $user = null): void
    {
        $user ??= Auth::guard('web')->user();

        if ($user) {
            $this->audit->safe('auth.logout', $user, "Logout: {$user->name}.");
        }

        Auth::guard('web')->logout();
    }

    /** Hash::check terhadap hash tiruan agar durasi setara dengan akun nyata. */
    private function dummyCheck(string $password): bool
    {
        static $dummy = null;
        $dummy ??= Hash::make('sigap-dummy-password');

        Hash::check($password, $dummy);

        return false;
    }
}
