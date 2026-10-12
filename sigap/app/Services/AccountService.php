<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Pengelolaan akun mandiri (profil & kata sandi) — dipakai bersama jalur Web
 * dan API agar aturannya identik (A-09, A-10, D-02).
 */
class AccountService
{
    public function __construct(private readonly AuditService $audit) {}

    /**
     * Perbarui email/telepon/kata sandi. Bila kata sandi berubah, semua sesi
     * lain & token API lain milik pengguna dicabut.
     *
     * @param  array<string, mixed>  $data  hasil validasi UpdateWargaProfileRequest
     */
    public function updateProfile(User $user, array $data, ?string $currentSessionId = null): void
    {
        $changed = [];

        if (! empty($data['email']) && $data['email'] !== $user->email) {
            $user->email = $data['email'];
            $changed[] = 'email';
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
    private function invalidateOtherSessions(User $user, string $plainPassword, ?string $currentSessionId): void
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
