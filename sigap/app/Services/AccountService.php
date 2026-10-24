<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Pengelolaan akun mandiri (daftar, profil, kata sandi) — dipakai bersama
 * jalur Web dan API agar aturannya identik (A-09, A-10, D-02).
 */
class AccountService
{
    public function __construct(private readonly AuditService $audit) {}

    /**
     * Pendaftaran mandiri akun warga. Warga langsung masuk (agar log aktivitas
     * tercatat atas namanya), tetapi Portal Warga baru terbuka setelah surel
     * diverifikasi (middleware `verified`).
     *
     * @param  array<string, mixed>  $data  hasil validasi RegisterWargaRequest
     */
    public function registerWarga(array $data): User
    {
        $user = User::create([
            'nik' => $data['nik'],
            'name' => $data['nama'],
            'email' => $data['email'],
            'phone' => $data['telepon'] ?? null,
            'role' => UserRole::Warga,
            'is_active' => true,
            'password' => $data['password'],
        ]);

        Auth::login($user);

        $this->audit->safe('account.registered', $user, "Akun warga didaftarkan: {$user->name}.");
        $this->sendVerification($user);

        return $user;
    }

    /** Ganti surel akun yang belum terverifikasi (salah ketik saat daftar) lalu kirim ulang tautan. */
    public function changeUnverifiedEmail(User $user, string $email): void
    {
        $user->forceFill(['email' => $email, 'email_verified_at' => null])->save();

        $this->audit->safe('account.profile_updated', $user, 'Surel akun diganti sebelum verifikasi.', ['fields' => ['email']]);
        $this->sendVerification($user);
    }

    /** Kirim tautan verifikasi; kegagalan SMTP tidak boleh menggagalkan permintaan. */
    public function sendVerification(User $user): void
    {
        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            Log::warning('Surel verifikasi gagal dikirim', ['user' => $user->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Kirim tautan atur ulang sandi untuk akun WARGA aktif yang cocok dengan
     * NIK atau surel. Hasil sengaja tidak dikembalikan agar keberadaan akun
     * tidak dapat ditebak; pemanggil selalu menampilkan pesan yang sama.
     */
    public function sendPasswordResetLink(string $identifier): void
    {
        $identifier = trim($identifier);

        $user = str_contains($identifier, '@')
            ? User::query()->where('email', $identifier)->first()
            : User::findByNik($identifier);

        if (! $user || $user->role !== UserRole::Warga || ! $user->is_active || empty($user->email)) {
            $this->audit->safe('auth.password_reset_requested', $user, 'Permintaan atur ulang sandi tanpa akun warga yang cocok.');

            return;
        }

        try {
            $status = Password::broker()->sendResetLink(['email' => $user->email]);
        } catch (\Throwable $e) {
            Log::warning('Surel atur ulang sandi gagal dikirim', ['user' => $user->id, 'error' => $e->getMessage()]);

            return;
        }

        $this->audit->safe('auth.password_reset_requested', $user, 'Tautan atur ulang sandi diminta.', ['status' => $status]);
    }

    /**
     * Simpan kata sandi baru dari tautan surel. Berhasil berarti surel
     * terbukti milik pengguna, jadi sekaligus ditandai terverifikasi.
     *
     * @return string status Password broker (Password::PASSWORD_RESET bila berhasil)
     */
    public function resetPassword(string $email, string $token, string $password): string
    {
        return Password::broker()->reset(
            ['email' => $email, 'token' => $token, 'password' => $password],
            function (User $user, string $password): void {
                if ($user->role !== UserRole::Warga) {
                    return;
                }

                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                    'email_verified_at' => $user->email_verified_at ?? now(),
                ])->save();

                $this->invalidateOtherSessions($user, $password, null);
                $this->audit->safe('account.password_reset', $user, 'Kata sandi diatur ulang lewat tautan surel.');
            },
        );
    }

    /**
     * Perbarui email/telepon/kata sandi. Bila kata sandi berubah, semua sesi
     * lain & token API lain milik pengguna dicabut.
     *
     * @param  array<string, mixed>  $data  hasil validasi UpdateWargaProfileRequest
     */
    public function updateProfile(User $user, array $data, ?string $currentSessionId = null): void
    {
        $changed = [];
        $emailChanged = false;

        if (! empty($data['email']) && $data['email'] !== $user->email) {
            $user->email = $data['email'];
            $changed[] = 'email';
            $emailChanged = true;

            // Surel baru warga harus diverifikasi ulang sebelum dipakai untuk
            // atur ulang sandi & notifikasi.
            if ($user->role === UserRole::Warga) {
                $user->email_verified_at = null;
            }
        }
        if (! empty($data['telp']) && $data['telp'] !== $user->phone) {
            $user->phone = $data['telp'];
            $changed[] = 'telp';
        }

        $passwordChanged = ! empty($data['password']);

        if ($passwordChanged) {
            $user->password = $data['password'];
            $changed[] = 'password';
        }

        $user->save();

        if ($emailChanged && $user->role === UserRole::Warga) {
            $this->sendVerification($user);
        }

        if ($passwordChanged) {
            $this->invalidateOtherSessions($user, (string) $data['password'], $currentSessionId);
            $this->audit->safe('account.password_changed', $user, 'Kata sandi akun diubah.');
        }

        if (array_diff($changed, ['password']) !== []) {
            $this->audit->safe('account.profile_updated', $user, 'Profil akun diperbarui.', [
                'fields' => array_values(array_diff($changed, ['password'])),
            ]);
        }
    }

    /** Cabut sesi web lain, token "ingat saya" dan token API lain. */
    public function invalidateOtherSessions(User $user, string $plainPassword, ?string $currentSessionId): void
    {
        // Sesi web (guard session): memutar remember token & hash sesi lain.
        $guard = Auth::guard('web');
        if ($guard->check() && $guard->id() === $user->id) {
            try {
                $guard->logoutOtherDevices($plainPassword);
            } catch (\Throwable) {
                // Abaikan: penghapusan sesi DB di bawah tetap berjalan.
            }
        }

        // Driver sesi database: hapus baris sesi lain milik pengguna.
        if (config('session.driver') === 'database') {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->id)
                ->when($currentSessionId, fn ($q) => $q->where('id', '!=', $currentSessionId))
                ->delete();
        }

        // Token API (Sanctum): sisakan hanya token yang sedang dipakai.
        $current = $user->currentAccessToken();
        $currentId = is_object($current) && isset($current->id) ? $current->id : null;

        $user->tokens()
            ->when($currentId, fn ($q) => $q->where('id', '!=', $currentId))
            ->delete();
    }
}
