<?php

use App\Http\Middleware\AuthenticateSession;
use App\Http\Middleware\EnsurePortalVerified;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Models\ActivityLog;
use App\Models\ChatConversation;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule) {
        // TECH-SPEC §11.2: scheduler untuk sinkron kanal (stub) & EWS.
        $schedule->command('sigap:sync-channels')->dailyAt('06:00')->withoutOverlapping();
        $schedule->command('sigap:ews-check')->dailyAt('07:00')->withoutOverlapping();
        $schedule->command('sigap:pantau-rujukan')->weekdays()->hourly()->between('8:00', '17:00')->withoutOverlapping();
        $schedule->command('sigap:cek-portal')->hourly()->withoutOverlapping();

        // Retensi data (D-01): hapus percakapan tamu kedaluwarsa & log audit lama.
        $schedule->command('model:prune', [
            '--model' => [ChatConversation::class, ActivityLog::class],
        ])->dailyAt('02:00')->withoutOverlapping();
    })
    ->withMiddleware(function (Middleware $middleware) {
        // Sanctum stateful: agar /api/v1 dapat memakai sesi cookie dari SPA
        // (PRD D1) sekaligus Bearer token untuk klien eksternal.
        $middleware->statefulApi();

        // N-03: Proxy tepercaya. Daftar IP/CIDR dibaca saat request dari
        // config('trustedproxy.proxies') (env TRUSTED_PROXIES, dipisah koma;
        // kosong = tidak ada proxy dipercaya; '*' sengaja ditolak) sehingga
        // tetap bekerja ketika `php artisan config:cache` aktif. Di produksi
        // nginx sudah menulis ulang REMOTE_ADDR dari CF-Connecting-IP
        // (real_ip), jadi cukup TRUSTED_PROXIES=127.0.0.1.
        $middleware->trustProxies(headers: Request::HEADER_X_FORWARDED_FOR
            | Request::HEADER_X_FORWARDED_HOST
            | Request::HEADER_X_FORWARDED_PORT
            | Request::HEADER_X_FORWARDED_PROTO);

        $middleware->web(append: [
            // Sesi lain otomatis tidak sah ketika kata sandi diganti.
            AuthenticateSession::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Header keamanan (SEC-03) untuk SEMUA respons: web maupun API.
        $middleware->append(SecurityHeaders::class);

        // Tamu yang mengakses halaman terproteksi diarahkan ke /masuk.
        $middleware->redirectGuestsTo(fn () => route('masuk'));
        $middleware->redirectUsersTo(fn () => route('home'));

        $middleware->alias([
            'role' => EnsureRole::class,
            'portal.verified' => EnsurePortalVerified::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // API selalu menerima galat JSON (bukan halaman HTML).
        $exceptions->shouldRenderJsonWhen(fn (Request $r) => $r->is('api/*') || $r->expectsJson());

        // Rate limit pada form Inertia (mis. /masuk): kembalikan pesan validasi
        // alih-alih modal HTML 429. Permintaan non-Inertia/API tetap 429.
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if (! $request->header('X-Inertia') || $request->isMethod('GET')) {
                return null;
            }

            $seconds = (int) ($e->getHeaders()['Retry-After'] ?? 60);
            $field = $request->has('identifier') ? 'identifier' : 'throttle';

            return back(303)
                ->withHeaders($e->getHeaders())
                ->withErrors([$field => "Terlalu banyak percobaan. Silakan coba lagi dalam {$seconds} detik."])
                ->withInput($request->except(['password', 'password_confirmation', 'attachment', 'recaptcha_token']));
        });
    })->create();
