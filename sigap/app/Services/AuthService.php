<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Autentikasi gabungan: warga (NIK) maupun petugas (username) lewat satu
 * identifier (PRD D3). Dipakai bersama oleh jalur Web (Inertia) & Api.
 */
class AuthService
{
    /**
     * Menentukan user dari identifier lalu memverifikasi kata sandi.
     *
     * @throws ValidationException
     */
    public function attempt(string $identifier, string $password, bool $remember = false): User
    {
        $identifier = trim($identifier);

        $user = User::query()
            ->where('username', $identifier)
            ->orWhere('nik', $identifier)
            ->first();

        if (! $user || ! $user->is_active || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'identifier' => 'NIK/username atau kata sandi salah.',
            ]);
        }

        Auth::login($user, $remember);

        return $user;
    }

    public function logout(): void
    {
        Auth::guard('web')->logout();
    }
}