<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\AuthenticateSession as BaseAuthenticateSession;
use Symfony\Component\HttpFoundation\Response;

/**
 * Validasi hash kata sandi di sesi (D-02): ketika kata sandi diganti, sesi
 * web lain otomatis tidak sah.
 *
 * Membungkus middleware bawaan Laravel agar hanya berjalan bila guard aktif
 * adalah guard sesi. Bila guard default berupa RequestGuard (mis. Sanctum
 * token), middleware bawaan akan error karena `viaRemember()` tidak ada.
 */
class AuthenticateSession extends BaseAuthenticateSession
{
    /**
     * @param  Request  $request
     * @param  Closure(Request): Response  $next
     */
    public function handle($request, Closure $next)
    {
        if (! $this->auth->guard() instanceof SessionGuard) {
            return $next($request);
        }

        return parent::handle($request, $next);
    }
}
