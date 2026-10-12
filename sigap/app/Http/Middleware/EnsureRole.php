<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Membatasi akses route berdasarkan peran (SEC-07).
 * Contoh: ->middleware('role:admin_kawasan,super_admin')
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return $this->deny($request);
        }

        $current = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        if (! in_array($current, $roles, true)) {
            return $this->deny($request, 'Akses khusus petugas');
        }

        return $next($request);
    }

    private function deny(Request $request, string $message = 'Akses khusus petugas'): Response
    {
        if ($request->expectsJson()) {
            return response()->json(['authenticated' => false, 'error' => $message], 401);
        }

        // Sudah login tetapi perannya tidak cocok.
        // Jika pengguna sudah berada di areanya sendiri (admin mengakses rute /admin
        // yang khusus super_admin, atau warga di area portal), ini murni masalah izin →
        // 403 (SEC-07). Redirect hanya dipakai saat pengguna berada di area yang salah
        // (mis. admin membuka /portal-warga) agar tidak terpantul ke /masuk.
        $user = $request->user();

        if (! $user) {
            return redirect()->route('masuk');
        }

        $path = trim($request->path(), '/');

        if ($user->isAdmin()) {
            if (str_starts_with($path, 'admin')) {
                abort(403, $message);
            }

            return redirect()->route('admin.dashboard');
        }

        if (str_starts_with($path, 'portal-warga')) {
            abort(403, $message);
        }

        return redirect()->route('warga.portal');
    }
}