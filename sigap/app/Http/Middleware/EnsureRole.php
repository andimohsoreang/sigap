<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Membatasi akses route berdasarkan peran (SEC-07).
 * Contoh: ->middleware('role:admin_kawasan,super_admin')
 *
 * - Belum login               : 401 (JSON) / redirect ke /masuk.
 * - Akun dinonaktifkan (A-08) : sesi diakhiri, token API dicabut, 403 (JSON)
 *                               / redirect ke /masuk dengan pesan.
 * - Peran tidak cocok (A-19)  : 403 (JSON). Untuk web, pengguna yang salah
 *                               area dialihkan ke areanya sendiri; di area
 *                               sendiri (mis. admin kawasan -> rute super
 *                               admin) dijawab 403.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return $this->unauthenticated($request);
        }

        if (! $user->is_active) {
            return $this->deactivated($request);
        }

        $current = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        if (! in_array($current, $roles, true)) {
            return $this->forbidden($request, 'Akses khusus petugas');
        }

        return $next($request);
    }

    private function wantsJson(Request $request): bool
    {
        return $request->expectsJson() || $request->is('api/*');
    }

    private function unauthenticated(Request $request): Response
    {
        if ($this->wantsJson($request)) {
            return response()->json(['authenticated' => false, 'error' => 'Silakan masuk terlebih dahulu.'], 401);
        }

        return redirect()->route('masuk');
    }

    /** Akun nonaktif: akhiri sesi & cabut token yang sedang dipakai. */
    private function deactivated(Request $request): Response
    {
        $user = $request->user();

        app(AuditService::class)->safe('auth.blocked_inactive', $user, 'Akses akun nonaktif ditolak.');

        $token = $user?->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
        }

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $message = 'Akun Anda dinonaktifkan. Hubungi admin Contact Center.';

        if ($this->wantsJson($request)) {
            return response()->json(['authenticated' => false, 'error' => $message], 403);
        }

        return redirect()->route('masuk')->with('error', $message);
    }

    private function forbidden(Request $request, string $message): Response
    {
        if ($this->wantsJson($request)) {
            return response()->json(['authenticated' => true, 'error' => $message], 403);
        }

        // Sudah login tetapi perannya tidak cocok.
        // Jika pengguna sudah berada di areanya sendiri (admin mengakses rute /admin
        // yang khusus super_admin, atau warga di area portal), ini murni masalah izin →
        // 403 (SEC-07). Redirect hanya dipakai saat pengguna berada di area yang salah
        // (mis. admin membuka /portal-warga) agar tidak terpantul ke /masuk.
        $user = $request->user();
        $path = trim($request->path(), '/');

        if ($user->isAdmin()) {
            if (str_starts_with($path, 'admin')) {
                abort(403, $message);
            }

            return redirect()->route('admin.dashboard');
        }

        if ($user->role === UserRole::Warga) {
            if (str_starts_with($path, 'portal-warga')) {
                abort(403, $message);
            }

            return redirect()->route('warga.portal');
        }

        // Peran lain (mis. pegawai) tidak memiliki area — langsung 403.
        abort(403, $message);
    }
}
