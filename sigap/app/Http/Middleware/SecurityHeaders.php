<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Header keamanan (PRD SEC-03). Menutup temuan audit: sebelumnya tidak ada
 * security header sama sekali.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
        $response->headers->set('Content-Security-Policy', $this->contentSecurityPolicy());

        // Hanya di HTTPS agar tidak merusak pengembangan lokal.
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }

    /**
     * Content-Security-Policy (SEC-03).
     *
     * Produksi memakai kebijakan ketat. Mode lokal/testing melonggarkan
     * 'unsafe-inline'/'unsafe-eval' + `ws:` agar Vite HMR & Reverb dev tetap
     * berjalan tanpa mengorbankan keamanan di server sesungguhnya.
     */
    private function contentSecurityPolicy(): string
    {
        $isStrict = app()->environment('production');

        $script = $isStrict ? "'self'" : "'self' 'unsafe-inline' 'unsafe-eval'";
        $style = $isStrict ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline'";

        $directives = [
            "default-src 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
            "script-src {$script}",
            "style-src {$style} https://fonts.bunny.net",
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
            "font-src 'self' data: https://fonts.bunny.net",
            // 'self' menutup XHR Inertia; ws/wss untuk Reverb.
            "connect-src 'self' ws: wss:",
            "worker-src 'self' blob:",
            "manifest-src 'self'",
        ];

        return implode('; ', $directives);
    }
}