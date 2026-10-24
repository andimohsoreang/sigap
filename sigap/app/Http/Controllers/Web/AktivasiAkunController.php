<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\AccountActivation;
use App\Services\StaffRegistrationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tautan sekali pakai dari chat petugas: warga yang didaftarkan petugas
 * membuat kata sandi pertamanya (aktivasi), atau warga yang lupa kata sandi
 * membuat kata sandi baru (pemulihan). Setelahnya langsung masuk Portal Warga.
 */
class AktivasiAkunController extends Controller
{
    public function __construct(private readonly StaffRegistrationService $registrations) {}

    public function show(string $token): Response
    {
        $activation = AccountActivation::findUsable($token);
        $user = $activation?->user;

        return Inertia::render('public/aktivasi-akun', [
            'token' => $activation ? $token : null,
            'jenis' => $activation?->purpose ?? AccountActivation::PURPOSE_ACTIVATION,
            'akun' => $user ? [
                'nama' => $user->name,
                'nik' => $user->maskedNik(),
                'berlaku_sampai' => $activation->expires_at->toIso8601String(),
            ] : null,
        ]);
    }

    public function store(Request $request, string $token): RedirectResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)->letters()->numbers()],
        ], [
            'password.required' => 'Kata sandi wajib diisi.',
            'password.confirmed' => 'Kata sandi yang diulang tidak sama.',
        ]);

        $activation = AccountActivation::findUsable($token);
        if (! $activation || ! $activation->user?->is_active) {
            throw ValidationException::withMessages([
                'password' => 'Tautan ini sudah dipakai atau kedaluwarsa. Minta tautan baru ke petugas lewat chat.',
            ]);
        }

        // Perangkat bersama: keluarkan akun lain yang masih masuk.
        if (Auth::check() && Auth::id() !== $activation->user_id) {
            Auth::logout();
        }

        $guestToken = $request->session()->pull(ChatController::SESSION_KEY);
        $this->registrations->activate($activation, $data['password'], $guestToken);
        $request->session()->regenerate();

        return redirect()
            ->route('warga.portal')
            ->with('success', $activation->isRecovery()
                ? 'Kata sandi baru tersimpan. Lain kali, masuk dengan NIK dan kata sandi baru ini.'
                : 'Akun Anda sudah aktif. Lain kali, masuk dengan NIK dan kata sandi yang baru Anda buat.');
    }
}
