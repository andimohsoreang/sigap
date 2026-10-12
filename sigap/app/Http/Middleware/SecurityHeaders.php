<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Header keamanan (PRD SEC-03, audit N-01/N-07).
 *
 * - Nonce CSP dibuat per request lewat Vite::useCspNonce(); nonce yang sama
 *   ditempel oleh @vite, @viteReactRefresh, dan @routes (Ziggy) di
 *   app.blade.php sehingga produksi tidak butuh 'unsafe-inline' untuk script.
 * - connect-src hanya 'self' + alamat WebSocket Reverb yang PERSIS (dari
 *   VITE_REVERB_*), bukan `ws: wss:` telanjang.
 */
class SecurityHeaders
{
    private const RECAPTCHA_SCRIPT = 'https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/';

    private const RECAPTCHA_FRAME = 'https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/';

    public function handle(Request $request, Closure $next): Response
    {
        // Harus dibuat SEBELUM view dirender agar tag <script> ikut membawa nonce.
        $nonce = Vite::useCspNonce();

        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
        $response->headers->set('Content-Security-Policy', $this->contentSecurityPolicy($nonce));

        // Hanya di HTTPS agar tidak merusak pengembangan lokal.
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }

    /**
     * Content-Security-Policy (SEC-03).
     *
     * Ketat (produksi, staging, dan lingkungan lain): script hanya dari
     * 'self' + nonce (+ domain reCAPTCHA bila kunci diisi). HANYA mode
     * local/testing yang melonggarkan 'unsafe-inline' / 'unsafe-eval' dan
     * mengizinkan server Vite HMR agar `npm run dev` jalan.
     */
    private function contentSecurityPolicy(string $nonce): string
    {
        $isStrict = ! app()->environment('local', 'testing');
        $recaptcha = filled(config('services.recaptcha.site_key'));
        $hot = $isStrict ? null : $this->viteHotOrigin();

        $script = $isStrict
            ? ["'self'", "'nonce-{$nonce}'"]
            : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
        // Tailwind/Leaflet/Inertia progress memakai atribut style inline.
        $style = ["'self'", "'unsafe-inline'", 'https://fonts.bunny.net'];
        $connect = ["'self'", ...$this->reverbOrigins($isStrict)];
        $frame = [];

        if ($recaptcha) {
            $script[] = self::RECAPTCHA_SCRIPT;
            $frame[] = self::RECAPTCHA_FRAME;
        }

        if ($hot !== null) {
            $script[] = $hot['http'];
            $style[] = $hot['http'];
            $connect[] = $hot['http'];
            $connect[] = $hot['ws'];
        }

        $directives = [
            "default-src 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
            'script-src '.implode(' ', $script),
            'style-src '.implode(' ', $style),
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
            "font-src 'self' data: https://fonts.bunny.net",
            'connect-src '.implode(' ', array_unique($connect)),
            'frame-src '.($frame === [] ? "'none'" : implode(' ', $frame)),
            "worker-src 'self' blob:",
            "manifest-src 'self'",
        ];

        return implode('; ', $directives);
    }

    /**
     * Origin WebSocket Reverb dari sisi browser (config reverb.client =
     * VITE_REVERB_*). https → wss, http → ws; port default tidak ditulis.
     *
     * @return list<string>
     */
    private function reverbOrigins(bool $isStrict): array
    {
        $host = trim((string) config('reverb.client.host'));

        if ($host === '' || ! preg_match('/^[A-Za-z0-9.\-]+$/', $host)) {
            return [];
        }

        $secure = strtolower((string) config('reverb.client.scheme', 'https')) === 'https';
        $scheme = $secure ? 'wss' : 'ws';
        $port = (int) config('reverb.client.port');
        $suffix = ($port > 0 && $port !== ($secure ? 443 : 80)) ? ':'.$port : '';

        $hosts = [$host];

        // Lokal: browser bisa membuka situs via localhost ATAU 127.0.0.1.
        if (! $isStrict && in_array($host, ['localhost', '127.0.0.1'], true)) {
            $hosts = ['localhost', '127.0.0.1'];
        }

        return array_map(fn (string $h) => "{$scheme}://{$h}{$suffix}", $hosts);
    }

    /**
     * Origin server Vite dev (public/hot) bila sedang `npm run dev`.
     *
     * @return array{http: string, ws: string}|null
     */
    private function viteHotOrigin(): ?array
    {
        if (! Vite::isRunningHot()) {
            return null;
        }

        $url = trim((string) @file_get_contents(Vite::hotFile()));
        $parts = parse_url($url);

        if (! is_array($parts) || ! isset($parts['scheme'], $parts['host'])) {
            return null;
        }

        $origin = $parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');

        return [
            'http' => $parts['scheme'].'://'.$origin,
            'ws' => ($parts['scheme'] === 'https' ? 'wss' : 'ws').'://'.$origin,
        ];
    }
}
