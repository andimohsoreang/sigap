<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pengganti middleware `verified` untuk Portal Warga: akun yang didaftarkan
 * petugas dari percakapan (identitas sudah dicek petugas) tidak perlu
 * menunggu verifikasi surel. Akun daftar mandiri tetap wajib verifikasi.
 */
class EnsurePortalVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && method_exists($user, 'isVerifiedForPortal') && ! $user->isVerifiedForPortal()) {
            return $request->expectsJson()
                ? abort(403, 'Alamat surel Anda belum diverifikasi.')
                : Redirect::guest(route('verification.notice'));
        }

        return $next($request);
    }
}
