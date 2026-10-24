<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Services\AccountService;
use App\Services\RecaptchaService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lupa kata sandi warga: minta tautan (NIK atau surel) lalu atur sandi baru.
 *
 * Pesan setelah meminta tautan SELALU sama, ada atau tidak akunnya, agar NIK
 * dan surel terdaftar tidak dapat ditebak. Hanya akun warga yang dilayani;
 * akun petugas diatur ulang oleh Super Admin.
 */
class LupaSandiController extends Controller
{
    public const SENT_MESSAGE = 'Bila NIK atau email tersebut terdaftar sebagai akun warga, tautan atur ulang kata sandi sudah dikirim ke email akun. Tautan berlaku 60 menit.';

    public function __construct(
        private readonly AccountService $accounts,
        private readonly RecaptchaService $recaptcha,
    ) {}

    public function create(Request $request): Response
    {
        return Inertia::render('public/lupa-sandi', [
            'status' => $request->session()->get('status'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'identifier' => ['required', 'string', 'max:150'],
            'recaptcha_token' => ['nullable', 'string', 'max:4096'],
        ], [
            'identifier.required' => 'Isi NIK atau email akun Anda.',
        ]);

        if (! $this->recaptcha->verify($request->input('recaptcha_token'), $request->ip(), RecaptchaService::ACTION_LUPA_SANDI)) {
            throw ValidationException::withMessages([
                'recaptcha_token' => 'Verifikasi reCAPTCHA gagal. Silakan muat ulang halaman dan coba lagi.',
            ]);
        }

        $this->accounts->sendPasswordResetLink((string) $request->input('identifier'));

        return back()->with('status', self::SENT_MESSAGE);
    }

    public function edit(Request $request, string $token): Response
    {
        return Inertia::render('public/atur-ulang-sandi', [
            'token' => $token,
            'email' => (string) $request->query('email', ''),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)->letters()->numbers()],
        ], [
            'password.required' => 'Kata sandi baru wajib diisi.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ]);

        $status = $this->accounts->resetPassword($data['email'], $data['token'], $data['password']);

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'password' => 'Tautan atur ulang tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.',
            ]);
        }

        return redirect()
            ->route('masuk')
            ->with('status', 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.');
    }
}
