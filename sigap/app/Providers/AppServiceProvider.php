<?php

namespace App\Providers;

use App\Models\Ticket;
use App\Models\User;
use App\Policies\TicketPolicy;
use App\Policies\UserPolicy;
use App\Support\Nik;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // D-01: produksi wajib punya NIK_HASH_KEY — gagal jelas saat boot
        // (request web/API), bukan diam-diam memakai APP_KEY. Perintah artisan
        // tetap jalan agar `config:cache`/`key:generate` dapat dipakai.
        if (! $this->app->runningInConsole()) {
            Nik::assertKeyConfigured();
        }

        Gate::policy(Ticket::class, TicketPolicy::class);
        Gate::policy(User::class, UserPolicy::class);

        // Rate limiter (PRD SEC-05). Semua kunci memakai $request->ip(), yang
        // berisi IP klien asli karena nginx menulis ulang REMOTE_ADDR dari
        // CF-Connecting-IP (lihat DEPLOY.md §nginx) & TrustProxies hanya
        // mempercayai proxy di config('trustedproxy.proxies').

        // 'login' (web /masuk & API /auth/login): 5x/menit per identifier+IP
        // (menahan tebak sandi satu akun) dan 20x/menit per IP (menahan
        // credential stuffing lintas akun dari satu sumber), plus 30x/jam per
        // identifier dari IP mana pun (tebak sandi terdistribusi).
        RateLimiter::for('login', function (Request $request) {
            $identifier = mb_strtolower(trim((string) $request->input('identifier')));

            return [
                Limit::perMinute(5)->by('login:id:'.sha1($identifier).'|'.$request->ip()),
                Limit::perMinute(20)->by('login:ip:'.$request->ip()),
                // Per akun lintas IP: menahan tebak sandi terdistribusi (botnet).
                Limit::perHour(30)->by('login:id:'.sha1($identifier)),
            ];
        });

        // Live chat punya limiter sendiri (tidak berbagi kuota dengan pengaduan).
        // Kunci per sesi + per IP: satu pengguna tidak menghabiskan kuota NAT kantor.
        $chatKey = fn (Request $request) => $request->user()?->id ?? $request->session()->getId();
        RateLimiter::for('chat', fn (Request $request) => [
            Limit::perMinute(20)->by('chat:s:'.$chatKey($request)),
            Limit::perMinute(60)->by('chat:ip:'.$request->ip()),
        ]);
        RateLimiter::for('chat-mulai', fn (Request $request) => Limit::perMinutes(10, 5)->by('chat-mulai:'.$request->ip()));
        RateLimiter::for('chat-baca', fn (Request $request) => [
            Limit::perMinute(30)->by('chat-baca:s:'.$chatKey($request)),
            Limit::perMinute(240)->by('chat-baca:ip:'.$request->ip()),
        ]);

        // 'pengaduan' membatasi spam tiket publik & survei (per IP asli).
        RateLimiter::for('pengaduan', fn (Request $request) => Limit::perMinutes(10, 10)->by('pengaduan:'.$request->ip()));

        // 'akun' membatasi daftar akun, lupa sandi & kirim ulang verifikasi
        // (anti-spam surel dan tebak NIK/surel terdaftar).
        // 'chat-lampiran': unggah foto/dokumen di chat (maks. 5 MB per file).
        RateLimiter::for('chat-lampiran', fn (Request $request) => [
            Limit::perMinute(6)->by('chat-lampiran:m:'.$request->ip()),
            Limit::perHour(30)->by('chat-lampiran:h:'.$request->ip()),
        ]);

        RateLimiter::for('akun', fn (Request $request) => [
            Limit::perMinutes(10, 5)->by('akun:'.$request->path().'|'.$request->ip()),
            Limit::perHour(30)->by('akun:ip:'.$request->ip()),
        ]);

        // 'lookup' membatasi pencarian nomor tiket publik (anti-enumerasi):
        // GET /lacak/{no}, GET /api/v1/tiket/{no}, dan rute survei.
        RateLimiter::for('lookup', fn (Request $request) => Limit::perMinute(30)->by('lookup:'.$request->ip()));

        // 'health' untuk /api/v1/health (monitor uptime cukup beberapa kali/menit).
        RateLimiter::for('health', fn (Request $request) => Limit::perMinute(60)->by('health:'.$request->ip()));
    }
}
