<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Services\AccountService;
use App\Services\AuditService;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Verifikasi surel akun warga: halaman tunggu, tautan dari surel, kirim
 * ulang, dan ganti surel bila salah ketik saat daftar.
 */
class VerifikasiEmailController extends Controller
{
    public function __construct(
        private readonly AccountService $accounts,
        private readonly AuditService $audit,
    ) {}

    public function notice(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        // Verifikasi surel hanya berlaku untuk Portal Warga.
        if ($user->isAdmin()) {
            return redirect()->route('admin.dashboard');
        }

        if ($user->isVerifiedForPortal()) {
            return redirect()->route('warga.portal');
        }

        return Inertia::render('public/verifikasi-email', [
            'email' => $user->maskedEmail(),
            'hasEmail' => ! empty($user->email),
        ]);
    }

    public function verify(EmailVerificationRequest $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
            $this->audit->safe('account.email_verified', $user, 'Surel akun terverifikasi.');
        }

        return redirect()
            ->route($user->isAdmin() ? 'admin.dashboard' : 'warga.portal')
            ->with('success', 'Email Anda terverifikasi. Selamat datang di Portal Warga.');
    }

    public function resend(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return redirect()->route('warga.portal');
        }

        $this->accounts->sendVerification($user);

        return back()->with('status', 'Tautan verifikasi baru sudah dikirim. Periksa juga folder Spam.');
    }

    public function changeEmail(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return redirect()->route('warga.portal');
        }

        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);

        $data = $request->validate([
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
        ], [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah dipakai akun lain.',
        ]);

        $this->accounts->changeUnverifiedEmail($user, $data['email']);

        return back()->with('status', 'Email diperbarui. Tautan verifikasi sudah dikirim ke alamat baru.');
    }
}
