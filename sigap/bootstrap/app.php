<?php

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

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
    })
    ->withMiddleware(function (Middleware $middleware) {
        // Sanctum stateful: agar /api/v1 dapat memakai sesi cookie dari SPA
        // (PRD D1) sekaligus Bearer token untuk klien eksternal.
        $middleware->statefulApi();

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Header keamanan (SEC-03) untuk SEMUA respons: web maupun API.
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);

        // Tamu yang mengakses halaman terproteksi diarahkan ke /masuk.
        $middleware->redirectGuestsTo(fn () => route('masuk'));
        $middleware->redirectUsersTo(fn () => route('home'));

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
