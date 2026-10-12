<?php

namespace App\Providers;

use App\Models\Ticket;
use App\Models\User;
use App\Policies\TicketPolicy;
use App\Policies\UserPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(Ticket::class, TicketPolicy::class);
        Gate::policy(User::class, UserPolicy::class);

        // Rate limiter (PRD SEC-05). 'login' membatasi per identifier + IP.
        RateLimiter::for('login', function (Request $request) {
            $key = (string) $request->input('identifier');

            return [
                Limit::perMinute(5)->by($key.'|'.$request->ip()),
                Limit::perMinute(20)->by($request->ip()),
            ];
        });

        // 'pengaduan' membatasi spam tiket publik & survei.
        RateLimiter::for('pengaduan', fn (Request $request) => Limit::perMinutes(10, 10)->by($request->ip()));
    }
}